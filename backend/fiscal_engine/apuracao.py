"""Apuração agregada de IBS/CBS — domínio puro (F0.7b).

Base normativa
--------------
- LC 214/2025 / EC 132 (RTC): IBS e CBS são tributos com apuração INDEPENDENTE e
  não-cumulatividade plena. Por isso os saldos por tributo NÃO se cruzam
  (``saldo_ibs`` e ``saldo_cbs`` separados); os agregados IBS+CBS existem apenas
  para exibição/indicadores, NUNCA para liquidação.

Princípios (CLAUDE.md / contrato F0.7b)
---------------------------------------
- Domínio PURO: sem IO/FastAPI/ORM/Pydantic; ``Decimal`` para todo dinheiro,
  quantizado a 2 casas (ROUND_HALF_UP) na composição do resultado.
- Reusa a F0.7a (``classify_rtc_impact``) e a F0.7b (``assess_conformity``) — NÃO
  recomputa regras nem reinspeciona CFOP fora do que essas funções já fazem.
- CONTRATO: confia no CONJUNTO recebido. O caller já selecionou o período e
  DEDUPLICOU por ``access_key``. ``apurar`` NÃO deduplica, NÃO valida a janela;
  ``period_start``/``period_end``/``granularity`` são apenas METADADOS do
  resultado.
"""

from collections.abc import Iterable, Iterator
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fiscal_engine.conformity import assess_conformity
from fiscal_engine.enums import Conformity, Direction, Granularity, RtcImpact, RtcReason
from fiscal_engine.impact import classify_rtc_impact
from fiscal_engine.models import Apuracao, FiscalDocument, InconformidadeRef

# Reasons que compõem o UNIVERSO COMERCIAL (entram em bases/créditos/débitos).
# EXCLUDED_CFOP e UNKNOWN_DIRECTION ficam de fora (não-comercial / sem direção).
_COMMERCIAL_REASONS: frozenset[RtcReason] = frozenset(
    {RtcReason.INBOUND, RtcReason.OUTBOUND, RtcReason.NO_HIGHLIGHT}
)
# Reasons que somam na base de ENTRADAS (com direção INBOUND).
_INBOUND_BASE_REASONS: frozenset[RtcReason] = frozenset({RtcReason.INBOUND, RtcReason.NO_HIGHLIGHT})
# Reasons que somam na base de SAÍDAS (com direção OUTBOUND).
_OUTBOUND_BASE_REASONS: frozenset[RtcReason] = frozenset(
    {RtcReason.OUTBOUND, RtcReason.NO_HIGHLIGHT}
)

_CENTS = Decimal("0.01")


def _quantize_money(value: Decimal) -> Decimal:
    """Quantiza um valor monetário a 2 casas decimais (ROUND_HALF_UP)."""
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def _compute_index(numerator: Decimal, denominator: Decimal) -> Decimal | None:
    """Calcula um índice percentual ``numerator/denominator*100`` (2 casas).

    Retorna ``None`` quando ``denominator == 0`` — NUNCA 0 nem exceção — para não
    confundir "sem base" com "zero por cento". Preserva o sinal do numerador
    (ex.: saldo devedor → índice negativo). Arredonda HALF_UP a 2 casas.
    """
    if denominator == 0:
        return None
    return (numerator / denominator * 100).quantize(_CENTS, rounding=ROUND_HALF_UP)


def _iter_assessable_units(
    doc: FiscalDocument,
) -> Iterator[tuple[int, str | None, Decimal, Decimal, Decimal]]:
    """Itera as unidades aferíveis de um documento: ITENS ou doc-level (nunca os dois).

    Produz tuplas ``(item_number, cfop, v_bc, v_ibs, v_cbs)``:

    - Se o documento tem ``items``: uma unidade por item (com o CFOP e os valores
      de cada linha).
    - Senão (ex.: CT-e e outros sem linhas): UMA unidade doc-level com o CFOP e os
      totais do documento (``v_bc_ibscbs``, ``v_ibs``, ``v_cbs``) e ``item_number=1``.

    Itens OU doc-level, NUNCA os dois — evita tanto perder o crédito de frete do
    CT-e (que não tem linhas) quanto a dupla contagem em documentos com itens.
    """
    if doc.items:
        for item in doc.items:
            yield (item.item_number, item.cfop, item.v_bc, item.v_ibs, item.v_cbs)
    else:
        yield (1, doc.cfop, doc.v_bc_ibscbs, doc.v_ibs, doc.v_cbs)


def apurar(
    documents: Iterable[FiscalDocument],
    *,
    period_start: date | None,
    period_end: date | None,
    granularity: Granularity,
) -> Apuracao:
    """Apura IBS/CBS e conformidade de um conjunto de documentos. PURA.

    Para cada documento e cada unidade aferível (ver ``_iter_assessable_units``):
    classifica o impacto (``classify_rtc_impact``, F0.7a) e a conformidade
    (``assess_conformity``, F0.7b), acumulando:

    - Créditos/débitos por tributo: ``v_ibs``/``v_cbs`` somam em crédito quando o
      impacto é CREDIT, em débito quando é DEBIT. Saldos por tributo NÃO cruzam
      IBS x CBS. Agregados = soma IBS+CBS (exibição, nunca liquidação).
    - Bases (universo comercial): ``v_bc`` soma em ``base_entradas`` quando a
      direção é INBOUND e o reason ∈ {INBOUND, NO_HIGHLIGHT}; em ``base_saidas``
      quando OUTBOUND e reason ∈ {OUTBOUND, NO_HIGHLIGHT}. EXCLUDED_CFOP e
      UNKNOWN_DIRECTION ficam de fora.
    - Índices percentuais (None quando a base é zero).
    - Contagens de conformidade por unidade e referências de inconformidade.

    Todo dinheiro é quantizado a 2 casas. NÃO deduplica nem valida a janela (o
    caller já o fez); ``period_*`` e ``granularity`` são metadados.
    """
    creditos_ibs_raw = Decimal("0")
    creditos_cbs_raw = Decimal("0")
    debitos_ibs_raw = Decimal("0")
    debitos_cbs_raw = Decimal("0")
    base_entradas_raw = Decimal("0")
    base_saidas_raw = Decimal("0")

    conforme_count = 0
    inconformidade_count = 0
    nao_avaliado_count = 0
    documentos_count = 0
    itens_count = 0
    inconformidades: list[InconformidadeRef] = []

    for doc in documents:
        documentos_count += 1
        for item_number, cfop, v_bc, v_ibs, v_cbs in _iter_assessable_units(doc):
            itens_count += 1
            impacto = classify_rtc_impact(
                direction=doc.direction, cfop=cfop, v_ibs=v_ibs, v_cbs=v_cbs
            )
            conformity, conf_reason = assess_conformity(
                reason=impacto.reason,
                tax_regime=doc.tax_regime,
                issue_date=doc.issue_date,
                cfop=cfop,
            )

            # Contagens de conformidade + drill-down das inconformidades.
            if conformity == Conformity.CONFORME:
                conforme_count += 1
            elif conformity == Conformity.INCONFORMIDADE:
                inconformidade_count += 1
                inconformidades.append(
                    InconformidadeRef(
                        access_key=doc.access_key,
                        item_number=item_number,
                        direction=doc.direction,
                        cfop=cfop,
                        reason=conf_reason,
                    )
                )
            else:  # Conformity.NAO_AVALIADO
                nao_avaliado_count += 1

            # Universo comercial: só INBOUND/OUTBOUND/NO_HIGHLIGHT contam.
            if impacto.reason not in _COMMERCIAL_REASONS:
                continue

            # Créditos/débitos por tributo (sem cruzar IBS x CBS).
            if impacto.impact == RtcImpact.CREDIT:
                creditos_ibs_raw += v_ibs
                creditos_cbs_raw += v_cbs
            elif impacto.impact == RtcImpact.DEBIT:
                debitos_ibs_raw += v_ibs
                debitos_cbs_raw += v_cbs

            # Bases por sentido econômico. Dois ``if`` independentes (não
            # mutuamente exclusivos no nível sintático): uma unidade tem UMA só
            # direção, então no máximo um soma — mas separá-los mantém o gate por
            # reason fiel ao contrato e cada arco (entrada/saída) testável.
            if doc.direction == Direction.INBOUND and impacto.reason in _INBOUND_BASE_REASONS:
                base_entradas_raw += v_bc
            if doc.direction == Direction.OUTBOUND and impacto.reason in _OUTBOUND_BASE_REASONS:
                base_saidas_raw += v_bc

    # Quantização final (centavos) dos eixos canônicos e agregados.
    creditos_ibs = _quantize_money(creditos_ibs_raw)
    creditos_cbs = _quantize_money(creditos_cbs_raw)
    debitos_ibs = _quantize_money(debitos_ibs_raw)
    debitos_cbs = _quantize_money(debitos_cbs_raw)
    saldo_ibs = _quantize_money(creditos_ibs_raw - debitos_ibs_raw)
    saldo_cbs = _quantize_money(creditos_cbs_raw - debitos_cbs_raw)

    creditos_raw = creditos_ibs_raw + creditos_cbs_raw
    debitos_raw = debitos_ibs_raw + debitos_cbs_raw
    creditos = _quantize_money(creditos_raw)
    debitos = _quantize_money(debitos_raw)
    saldo = _quantize_money(creditos_raw - debitos_raw)

    base_entradas = _quantize_money(base_entradas_raw)
    base_saidas = _quantize_money(base_saidas_raw)

    return Apuracao(
        period_start=period_start,
        period_end=period_end,
        granularity=granularity,
        creditos_ibs=creditos_ibs,
        creditos_cbs=creditos_cbs,
        debitos_ibs=debitos_ibs,
        debitos_cbs=debitos_cbs,
        saldo_ibs=saldo_ibs,
        saldo_cbs=saldo_cbs,
        creditos=creditos,
        debitos=debitos,
        saldo=saldo,
        base_entradas=base_entradas,
        base_saidas=base_saidas,
        idx_credito_entradas=_compute_index(creditos, base_entradas),
        idx_debito_saidas=_compute_index(debitos, base_saidas),
        idx_saldo_saidas=_compute_index(saldo, base_saidas),
        idx_saldo_saidas_ibs=_compute_index(saldo_ibs, base_saidas),
        idx_saldo_saidas_cbs=_compute_index(saldo_cbs, base_saidas),
        conforme_count=conforme_count,
        inconformidade_count=inconformidade_count,
        nao_avaliado_count=nao_avaliado_count,
        documentos_count=documentos_count,
        itens_count=itens_count,
        inconformidades=tuple(inconformidades),
    )

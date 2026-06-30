"""Avaliação de conformidade RTC (IBS/CBS) — domínio puro (F0.7b).

Base normativa
--------------
- LC 214/2025 / EC 132 (RTC): o regime IBS/CBS inicia sua vigência em 2026 — por
  isso documentos sem data ou anteriores a ``2026-01-01`` ficam FORA do alcance
  (``NAO_AVALIADO``). Exportações (CFOP 7.xxx, exceto 79xx) são IMUNES (EC 132,
  art. 149-B / LC 214/2025) — destaque ausente é CONFORME.
- SPEC_BUSINESS_RULES.md §3.4: fornecedor Simples Nacional (dentro do sublimite)
  não destaca IBS/CBS — ausência de destaque é a REGRA do regime, logo CONFORME.
  Já RPA e Simples em EXCESSO de sublimite devem destacar em operação comercial;
  ausência é candidata a INCONFORMIDADE.

Princípios (CLAUDE.md / contrato F0.7b)
---------------------------------------
- Domínio PURO: sem IO/FastAPI/ORM/Pydantic; ``Decimal`` para dinheiro.
- Esta camada CONSOME o ``RtcReason`` da F0.7a — NÃO recomputa o impacto.
  Inspeciona ``cfop`` SOMENTE no ramo ``EXCLUDED_CFOP`` (para distinguir
  exportação imune de operação não-comercial), reusando ``_normalize_cfop``.
- NÃO há whitelist de CFOP: a fonte única de verdade é o ``reason`` já calculado
  (decisão da revisão / ADR 0010). Confiar no reason evita falso-negativo — um
  CFOP comercial sem destaque continua chegando como ``NO_HIGHLIGHT`` e é
  corretamente sinalizado conforme o regime.
"""

from datetime import date

from fiscal_engine.enums import (
    Conformity,
    ConformityReason,
    Direction,
    RtcReason,
    TaxRegime,
)
from fiscal_engine.impact import _normalize_cfop, classify_item
from fiscal_engine.models import FiscalItem, ItemConformity

# Início da vigência do regime IBS/CBS (LC 214/2025 / EC 132): documentos
# anteriores a esta data ficam fora do alcance da regra de conformidade.
_RTC_START = date(2026, 1, 1)


def assess_conformity(
    *,
    reason: RtcReason,
    tax_regime: TaxRegime,
    issue_date: date | None,
    cfop: str | None,
) -> tuple[Conformity, ConformityReason]:
    """Avalia a conformidade RTC de uma unidade a partir do ``reason`` da F0.7a.

    PURA. CONSOME ``reason`` (não recomputa impacto). O ``cfop`` só é inspecionado
    no ramo ``EXCLUDED_CFOP``, para separar exportação imune (CONFORME) de
    operação não-comercial (NAO_AVALIADO).

    Tabela de decisão (precedência EXATA, de cima para baixo):
        1) issue_date is None                 → (NAO_AVALIADO, DATA_AUSENTE)
        2) issue_date < 2026-01-01            → (NAO_AVALIADO, PRE_2026)
        3) reason == UNKNOWN_DIRECTION        → (NAO_AVALIADO, DIRECAO_DESCONHECIDA)
        4) reason == EXCLUDED_CFOP:
             4a) CFOP norm. 4 díg. "7…" e NÃO "79…"
                                              → (CONFORME, EXPORTACAO_IMUNE)
             4b) caso contrário               → (NAO_AVALIADO, NAO_COMERCIAL)
        5) reason in {INBOUND, OUTBOUND}      → (CONFORME, DESTAQUE_PRESENTE)
        6) reason == NO_HIGHLIGHT → ramifica por tax_regime:
             SIMPLES_NACIONAL                 → (CONFORME, REGIME_SIMPLES)
             RPA                              → (INCONFORMIDADE, RPA_SEM_DESTAQUE)
             SIMPLES_EXCESSO                  → (INCONFORMIDADE,
                                                 SIMPLES_EXCESSO_SEM_DESTAQUE)
             MEI                              → (NAO_AVALIADO, REGIME_MEI)
             UNKNOWN                          → (NAO_AVALIADO, REGIME_DESCONHECIDO)

    Precedências notáveis: data ausente/pré-2026 vencem QUALQUER regime ou destaque
    (fora de vigência não se avalia nada); um documento de 2025 com CFOP 7101 cai
    em ``PRE_2026``, não em ``EXPORTACAO_IMUNE``.
    """
    # 1) Sem data: fora do alcance (não dá para situar na vigência RTC).
    if issue_date is None:
        return (Conformity.NAO_AVALIADO, ConformityReason.DATA_AUSENTE)

    # 2) Anterior à vigência IBS/CBS (LC 214/2025): não se avalia.
    if issue_date < _RTC_START:
        return (Conformity.NAO_AVALIADO, ConformityReason.PRE_2026)

    # 3) Direção indefinida pelo parser: sem sentido econômico para avaliar.
    if reason == RtcReason.UNKNOWN_DIRECTION:
        return (Conformity.NAO_AVALIADO, ConformityReason.DIRECAO_DESCONHECIDA)

    # 4) CFOP excluído: separar exportação imune de operação não-comercial.
    if reason == RtcReason.EXCLUDED_CFOP:
        norm = _normalize_cfop(cfop)
        # 4a) Exportação 7.xxx (exceto 79xx) — imune (EC 132 / LC 214/2025).
        if (
            norm is not None
            and len(norm) == 4
            and norm.startswith("7")
            and not norm.startswith("79")
        ):
            return (Conformity.CONFORME, ConformityReason.EXPORTACAO_IMUNE)
        # 4b) Demais exclusões (79xx, 59, 69, 515, 615 ou não-normalizável):
        #     remessas, transferências, brindes — não-comercial, não se avalia.
        return (Conformity.NAO_AVALIADO, ConformityReason.NAO_COMERCIAL)

    # 5) Operação comercial com destaque (crédito de entrada / débito de saída).
    if reason in (RtcReason.INBOUND, RtcReason.OUTBOUND):
        return (Conformity.CONFORME, ConformityReason.DESTAQUE_PRESENTE)

    # 6) Operação comercial SEM destaque (reason == NO_HIGHLIGHT): depende do
    #    regime para distinguir ausência legítima (Simples) de inconformidade.
    if tax_regime == TaxRegime.SIMPLES_NACIONAL:
        # Dentro do sublimite: não destacar IBS/CBS é a regra do regime.
        return (Conformity.CONFORME, ConformityReason.REGIME_SIMPLES)
    if tax_regime == TaxRegime.RPA:
        return (Conformity.INCONFORMIDADE, ConformityReason.RPA_SEM_DESTAQUE)
    if tax_regime == TaxRegime.SIMPLES_EXCESSO:
        # Acima do sublimite: deve apurar por fora — ausência é inconformidade.
        return (Conformity.INCONFORMIDADE, ConformityReason.SIMPLES_EXCESSO_SEM_DESTAQUE)
    if tax_regime == TaxRegime.MEI:
        # Conservador (pendência SME P3): não sinalizar sem regra fechada.
        return (Conformity.NAO_AVALIADO, ConformityReason.REGIME_MEI)
    # tax_regime == TaxRegime.UNKNOWN — regime não inferido.
    return (Conformity.NAO_AVALIADO, ConformityReason.REGIME_DESCONHECIDO)


def assess_item(
    item: FiscalItem,
    *,
    direction: Direction,
    tax_regime: TaxRegime,
    issue_date: date | None,
) -> ItemConformity:
    """Avalia a conformidade de um ``FiscalItem`` (wrapper sobre ``assess_conformity``).

    Classifica o impacto do item via ``classify_item`` (F0.7a) e alimenta o
    ``reason`` resultante em ``assess_conformity``, junto com regime, data e o
    CFOP do próprio item. Carimba ``direction`` no ``ItemConformity`` para a
    mensagem de apresentação (§5.4) — o veredito em si é direction-simétrico.
    """
    classification = classify_item(item, direction)
    conformity, conf_reason = assess_conformity(
        reason=classification.reason,
        tax_regime=tax_regime,
        issue_date=issue_date,
        cfop=item.cfop,
    )
    return ItemConformity(
        item_number=item.item_number,
        conformity=conformity,
        reason=conf_reason,
        direction=direction,
    )

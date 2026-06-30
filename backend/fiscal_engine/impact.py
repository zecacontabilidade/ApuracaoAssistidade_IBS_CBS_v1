"""Regra de impacto RTC (crédito/débito/neutro) — domínio puro.

Base normativa
--------------
- LC 214/2025 / EC 132 (RTC): IBS/CBS; exportações (CFOP 7.xxx) são IMUNES
  (não geram débito nem crédito) — por isso entram na lista de exclusão.
- SPEC_XML_MAPPING_v2.md (regra de direção/CFOP): "A determinação de crédito
  ou débito de IBS/CBS NÃO é dirigida pelo CFOP." O CFOP cumpre papel
  SECUNDÁRIO: filtrar operações não-comerciais (brindes, remessas, amostras,
  exportações) que não geram obrigação de destaque. Fora isso, direção +
  destaque (vIBS/vCBS) definem o impacto:
      INBOUND  + vIBS/vCBS > 0 → CRÉDITO
      OUTBOUND + vIBS/vCBS > 0 → DÉBITO
      (in|out)bound + vIBS/vCBS = 0 → NEUTRAL (NO_HIGHLIGHT)
  NOTA: adotamos a PROSA da spec v2 (com zero-check EXPLÍCITO), e NÃO o
  pseudocódigo ``enrichItem`` que omite o teste de destaque zero. A distinção
  entre NEUTRAL-esperado e candidato a INCONFORMIDADE é feita na F0.7b via
  ``RtcReason`` — aqui apenas registramos o motivo, sem recomputar.
- SPEC_BUSINESS_RULES.md §3.4: entrada de fornecedor Simples Nacional não
  destaca IBS/CBS (vIBS=vCBS=0) → ``rtc_impact = NEUTRAL`` (não é inconformidade
  do fornecedor, é a regra do regime). Cai naturalmente no ramo NO_HIGHLIGHT.
- docs/data-model.md: ``RtcImpact`` tem exatamente 3 valores.
"""

from decimal import Decimal

from fiscal_engine.enums import Direction, RtcImpact, RtcReason
from fiscal_engine.models import FiscalItem, RtcClassification

# -----------------------------------------------------------------------------
# CFOP excluídos da análise de conformidade (geram NEUTRAL).
#
# Comparação por PREFIXO sobre o CFOP normalizado de 4 dígitos (sem o ponto):
#   "7"   → todo 7.xxx — exportação IMUNE (LC 214/2025 / EC 132).
#   "59"  → 5.9xx — remessas/brindes/amostras/consignação/industrialização p/
#           terceiros (cobre 5.901, 5.910, 5.911, 5.915 etc.).
#   "69"  → 6.9xx — contrapartes interestaduais das 5.9xx.
#   "515" → 5.15x — transferências entre estabelecimentos próprios.
#           DECISÃO DO HUMANO: excluir ⇒ NEUTRAL até regulamentação.
#   "615" → 6.15x — transferências interestaduais entre estabelecimentos
#           próprios. Idem (decisão do humano).
# -----------------------------------------------------------------------------
CFOP_EXCLUDED_PREFIXES: frozenset[str] = frozenset({"7", "59", "69", "515", "615"})


def _normalize_cfop(cfop: str | None) -> str | None:
    """Normaliza o CFOP removendo tudo que não for dígito ASCII (0-9).

    ``'5.915' → '5915'``, ``'5915' → '5915'``. Retorna ``None`` se a entrada
    for ``None`` ou não contiver dígito ASCII algum (string vazia após
    filtragem).

    Filtro ASCII ESTRITO (``ch in "0123456789"``) — NÃO ``str.isdigit()``: este
    último aceita dígitos Unicode (ex.: fullwidth U+FF10..U+FF19, sobrescritos,
    numerais de outras escritas) que NÃO são CFOP válido. Deixá-los passar
    geraria um código "limpo" enganoso, escapando da exclusão e produzindo
    CREDIT/DEBIT onde o correto é NEUTRAL — uma falha silenciosa. Restringir ao
    ASCII canônico garante que só CFOP legítimo seja avaliado.
    """
    if cfop is None:
        return None
    digits = "".join(ch for ch in cfop if ch in "0123456789")
    return digits or None


def is_excluded_cfop(cfop: str | None) -> bool:
    """Indica se o CFOP está na lista de exclusão (⇒ NEUTRAL).

    Guarda de robustez: só CFOP com EXATAMENTE 4 dígitos após normalização é
    avaliado. Isso protege contra códigos que NÃO são CFOP de 4 dígitos — por
    exemplo o ``cTribNac``/NBS da NFS-e (9 dígitos) mapeado para ``item.cfop``
    no padrão nacional (SPEC_XML_MAPPING_v2). Entradas inválidas (None, vazio,
    não numéricas, comprimento ≠ 4) retornam ``False``.
    """
    code = _normalize_cfop(cfop)
    if code is None or len(code) != 4:
        return False
    return any(code.startswith(prefix) for prefix in CFOP_EXCLUDED_PREFIXES)


def classify_rtc_impact(
    *,
    direction: Direction,
    cfop: str | None,
    v_ibs: Decimal,
    v_cbs: Decimal,
) -> RtcClassification:
    """Classifica o impacto RTC de uma operação.

    Pré-condição: ``v_ibs`` e ``v_cbs`` devem ser valores FINITOS e ``>= 0``
    (valores destacados não são negativos nem NaN/Infinity); caso contrário,
    ``ValueError``. O teste de finitude vem ANTES do de sinal: ``Decimal('NaN')``
    não é ordenável (comparações com ``<`` retornam ``False`` em vez de levantar),
    o que mascararia a entrada inválida e a faria cair num ramo de classificação.

    Precedência EXATA (ordem importa):
        1) direção UNKNOWN          → (NEUTRAL, UNKNOWN_DIRECTION)
        2) CFOP excluído            → (NEUTRAL, EXCLUDED_CFOP)
        3) vIBS + vCBS == 0         → (NEUTRAL, NO_HIGHLIGHT)
        4) direção INBOUND          → (CREDIT, INBOUND)
        5) direção OUTBOUND         → (DEBIT, OUTBOUND)

    Como (1) já cobre UNKNOWN, em (4)/(5) ``direction`` é necessariamente
    INBOUND ou OUTBOUND.
    """
    if not v_ibs.is_finite() or not v_cbs.is_finite():
        raise ValueError(
            f"Valores destacados devem ser finitos (sem NaN/Infinity): v_ibs={v_ibs}, v_cbs={v_cbs}"
        )
    if v_ibs < 0 or v_cbs < 0:
        raise ValueError(
            f"Valores destacados não podem ser negativos: v_ibs={v_ibs}, v_cbs={v_cbs}"
        )

    # 1) Direção desconhecida: sem sentido econômico definido pelo parser.
    if direction == Direction.UNKNOWN:
        return RtcClassification(RtcImpact.NEUTRAL, RtcReason.UNKNOWN_DIRECTION)

    # 2) CFOP excluído (exportação imune, remessas, transferências): neutro.
    if is_excluded_cfop(cfop):
        return RtcClassification(RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP)

    # 3) Sem destaque de IBS/CBS: neutro (ex.: fornecedor Simples Nacional).
    #    Soma em Decimal — nunca float — para preservar a exatidão monetária.
    if v_ibs + v_cbs == 0:
        return RtcClassification(RtcImpact.NEUTRAL, RtcReason.NO_HIGHLIGHT)

    # 4) Entrada econômica com destaque → crédito.
    if direction == Direction.INBOUND:
        return RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)

    # 5) Saída econômica com destaque → débito.
    return RtcClassification(RtcImpact.DEBIT, RtcReason.OUTBOUND)


def classify_item(item: FiscalItem, direction: Direction) -> RtcClassification:
    """Classifica o impacto RTC de um ``FiscalItem`` na direção informada.

    Delega a ``classify_rtc_impact`` usando o CFOP e os valores destacados do
    item. A direção é do DOCUMENTO (calculada pelo parser F1.5) e aplica-se a
    todos os itens.
    """
    return classify_rtc_impact(
        direction=direction,
        cfop=item.cfop,
        v_ibs=item.v_ibs,
        v_cbs=item.v_cbs,
    )

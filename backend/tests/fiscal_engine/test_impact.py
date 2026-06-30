"""Testes da regra de impacto RTC (``fiscal_engine.impact``).

Matriz de casos do contrato F0.7a — fixtures sintéticas (sem dado real).
"""

from collections.abc import Callable
from decimal import Decimal

import pytest

from fiscal_engine.enums import Direction, RtcImpact, RtcReason
from fiscal_engine.impact import (
    classify_item,
    classify_rtc_impact,
    is_excluded_cfop,
)
from fiscal_engine.models import FiscalItem, RtcClassification

POS_IBS = Decimal("8.80")
POS_CBS = Decimal("0.90")
ZERO = Decimal("0")


# 1. Compra normal: INBOUND + 5102 + soma>0 => (CREDIT, INBOUND)
def test_compra_normal_gera_credito() -> None:
    result = classify_rtc_impact(
        direction=Direction.INBOUND, cfop="5102", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)


# 2. Venda normal: OUTBOUND + 5102 + >0 => (DEBIT, OUTBOUND)
def test_venda_normal_gera_debito() -> None:
    result = classify_rtc_impact(
        direction=Direction.OUTBOUND, cfop="5102", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.DEBIT, RtcReason.OUTBOUND)


# 3. Exportação: OUTBOUND + 7101 + >0 => (NEUTRAL, EXCLUDED_CFOP)
def test_exportacao_e_neutra_por_imunidade() -> None:
    result = classify_rtc_impact(
        direction=Direction.OUTBOUND, cfop="7101", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP)


# 4. Parametrizado: exclusão OUTBOUND>0 sobre CFOPs de remessa/exportação.
@pytest.mark.parametrize(
    "cfop",
    ["5915", "5910", "5911", "5901", "7101", "7999", "6915"],
)
def test_cfops_excluidos_sao_neutros(cfop: str) -> None:
    result = classify_rtc_impact(
        direction=Direction.OUTBOUND, cfop=cfop, v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP)


# 5. TRANSFERÊNCIA (decisão do humano): excluir => NEUTRAL.
def test_transferencia_saida_e_neutra() -> None:
    result = classify_rtc_impact(
        direction=Direction.OUTBOUND, cfop="5152", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP)


def test_transferencia_interestadual_entrada_e_neutra() -> None:
    result = classify_rtc_impact(
        direction=Direction.INBOUND, cfop="6152", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP)


# 6. Fornecedor Simples: INBOUND + 5102 + sem destaque => (NEUTRAL, NO_HIGHLIGHT)
def test_fornecedor_simples_sem_destaque_e_neutro() -> None:
    result = classify_rtc_impact(direction=Direction.INBOUND, cfop="5102", v_ibs=ZERO, v_cbs=ZERO)
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.NO_HIGHLIGHT)


# 7. RPA saída sem destaque: OUTBOUND + 5102 + zero => (NEUTRAL, NO_HIGHLIGHT)
def test_saida_sem_destaque_e_neutro() -> None:
    result = classify_rtc_impact(direction=Direction.OUTBOUND, cfop="5102", v_ibs=ZERO, v_cbs=ZERO)
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.NO_HIGHLIGHT)


# 8. Direção UNKNOWN + qualquer => (NEUTRAL, UNKNOWN_DIRECTION)
def test_direcao_desconhecida_e_neutra() -> None:
    result = classify_rtc_impact(
        direction=Direction.UNKNOWN, cfop="5102", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.UNKNOWN_DIRECTION)


# 9. Precedência UNKNOWN > EXCLUDED: UNKNOWN + 7101 + >0 => UNKNOWN_DIRECTION.
def test_precedencia_unknown_vence_excluded() -> None:
    result = classify_rtc_impact(
        direction=Direction.UNKNOWN, cfop="7101", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.UNKNOWN_DIRECTION)


# 10. Precedência EXCLUDED > ZERO: OUTBOUND + 5915 + zero => EXCLUDED_CFOP.
def test_precedencia_excluded_vence_zero() -> None:
    result = classify_rtc_impact(direction=Direction.OUTBOUND, cfop="5915", v_ibs=ZERO, v_cbs=ZERO)
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP)


# GAP-1. Precedência UNKNOWN > NO_HIGHLIGHT: UNKNOWN + 5102 + zero => UNKNOWN_DIRECTION.
# Prova que a regra 1 (UNKNOWN) vence a regra 3 (destaque zero) diretamente, fechando
# os três pares adjacentes da matriz: UNKNOWN>EXCLUDED (t.9), EXCLUDED>ZERO (t.10),
# UNKNOWN>ZERO (este teste).
def test_precedencia_unknown_vence_no_highlight() -> None:
    result = classify_rtc_impact(direction=Direction.UNKNOWN, cfop="5102", v_ibs=ZERO, v_cbs=ZERO)
    assert result == RtcClassification(RtcImpact.NEUTRAL, RtcReason.UNKNOWN_DIRECTION)


# 11. Borda do destaque: só vIBS>0, depois só vCBS>0.
def test_apenas_ibs_positivo_gera_credito() -> None:
    result = classify_rtc_impact(
        direction=Direction.INBOUND, cfop="5102", v_ibs=Decimal("0.01"), v_cbs=ZERO
    )
    assert result == RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)


def test_apenas_cbs_positivo_gera_debito() -> None:
    result = classify_rtc_impact(
        direction=Direction.OUTBOUND, cfop="5102", v_ibs=ZERO, v_cbs=Decimal("0.01")
    )
    assert result == RtcClassification(RtcImpact.DEBIT, RtcReason.OUTBOUND)


# GAP-2. Quarto quadrante: só vCBS>0, vIBS=0, INBOUND => (CREDIT, INBOUND).
# Espelha test_apenas_ibs_positivo_gera_credito (INBOUND+só-IBS) e
# test_apenas_cbs_positivo_gera_debito (OUTBOUND+só-CBS), fechando a matriz 2x2.
def test_apenas_cbs_positivo_inbound_gera_credito() -> None:
    result = classify_rtc_impact(
        direction=Direction.INBOUND, cfop="5102", v_ibs=ZERO, v_cbs=Decimal("0.01")
    )
    assert result == RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)


# 12. NFS-e tomador: cfop=None + INBOUND + >0 => (CREDIT, INBOUND)
def test_nfse_tomador_gera_credito_sem_cfop() -> None:
    result = classify_rtc_impact(
        direction=Direction.INBOUND, cfop=None, v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)


# 13. NFS-e prestador: cfop=None + OUTBOUND + >0 => (DEBIT, OUTBOUND)
def test_nfse_prestador_gera_debito_sem_cfop() -> None:
    result = classify_rtc_impact(
        direction=Direction.OUTBOUND, cfop=None, v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.DEBIT, RtcReason.OUTBOUND)


# 14. CT-e tomador: CFOP '1351' (4-díg não-excluído) + INBOUND + >0 => CREDIT.
def test_cte_tomador_gera_credito() -> None:
    result = classify_rtc_impact(
        direction=Direction.INBOUND, cfop="1351", v_ibs=POS_IBS, v_cbs=POS_CBS
    )
    assert result == RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)


# 15. is_excluded_cfop: variações com/sem ponto para remessa e transferências.
@pytest.mark.parametrize(
    "cfop",
    ["5.915", "5915", "5.152", "5152", "6.152"],
)
def test_is_excluded_cfop_aceita_ponto_e_transferencias(cfop: str) -> None:
    assert is_excluded_cfop(cfop) is True


# 16. is_excluded_cfop: exportação/remessa True; comerciais False.
@pytest.mark.parametrize(
    ("cfop", "expected"),
    [
        ("7101", True),
        ("7999", True),
        ("6915", True),
        ("6102", False),
        ("5102", False),
    ],
)
def test_is_excluded_cfop_classifica_corretamente(cfop: str, expected: bool) -> None:
    assert is_excluded_cfop(cfop) is expected


# 17. is_excluded_cfop: guardas contra entradas que NÃO são CFOP de 4 dígitos.
# "591000000" é um NBS de 9 dígitos que INICIA com o prefixo excluído "59" —
# prova que a guarda len==4 vence o startswith antes de avaliar o prefixo (GAP-4).
@pytest.mark.parametrize(
    "cfop",
    [None, "", "101010000", "591000000", "abc", "5.9"],
)
def test_is_excluded_cfop_guards_retornam_false(cfop: str | None) -> None:
    assert is_excluded_cfop(cfop) is False


# 17b. Hardening anti-falha-silenciosa: dígitos Unicode NÃO-ASCII (ex.: fullwidth
# U+FF10..U+FF19, que casariam o prefixo "59" se ``str.isdigit()`` os
# normalizasse) NÃO contam — só o ASCII canônico 0-9. O normalizador descarta-os,
# sobra string vazia => não é CFOP de 4 dígitos => is_excluded_cfop = False
# (evita NEUTRAL espúrio). Construímos os literais via codepoint (sem caractere
# ambíguo no fonte) para não disparar RUF001 e deixar a intenção explícita.
def _to_fullwidth(ascii_digits: str) -> str:
    """Converte dígitos ASCII em FULLWIDTH (U+FF10..U+FF19 = '0'-'9' + 0xFEE0)."""
    return "".join(chr(ord(ch) + 0xFEE0) for ch in ascii_digits)


@pytest.mark.parametrize("ascii_cfop", ["5915", "7101", "5152"])
def test_is_excluded_cfop_ignora_digitos_fullwidth(ascii_cfop: str) -> None:
    # Sanidade: o equivalente ASCII É excluído; só a forma fullwidth deve falhar.
    assert is_excluded_cfop(ascii_cfop) is True
    assert is_excluded_cfop(_to_fullwidth(ascii_cfop)) is False


# 18. Pré-condição: vIBS<0 ou vCBS<0 => ValueError.
def test_v_ibs_negativo_levanta_value_error() -> None:
    with pytest.raises(ValueError, match="negativos"):
        classify_rtc_impact(
            direction=Direction.INBOUND, cfop="5102", v_ibs=Decimal("-1"), v_cbs=ZERO
        )


def test_v_cbs_negativo_levanta_value_error() -> None:
    with pytest.raises(ValueError, match="negativos"):
        classify_rtc_impact(
            direction=Direction.OUTBOUND, cfop="5102", v_ibs=ZERO, v_cbs=Decimal("-0.01")
        )


# 18b. Pré-condição de finitude: NaN/Infinity em vIBS ou vCBS => ValueError.
# Decimal('NaN') não é ordenável (``< 0`` retorna False sem levantar), então sem
# este guard a entrada inválida escaparia para um ramo de classificação. A msg
# cita "finitos" para distinguir do erro de valor negativo.
@pytest.mark.parametrize(
    ("v_ibs", "v_cbs"),
    [
        (Decimal("NaN"), ZERO),
        (ZERO, Decimal("NaN")),
        (Decimal("Infinity"), ZERO),
        (ZERO, Decimal("Infinity")),
        (Decimal("-Infinity"), ZERO),
        (Decimal("sNaN"), ZERO),
    ],
)
def test_valores_nao_finitos_levantam_value_error(v_ibs: Decimal, v_cbs: Decimal) -> None:
    with pytest.raises(ValueError, match="finitos"):
        classify_rtc_impact(direction=Direction.INBOUND, cfop="5102", v_ibs=v_ibs, v_cbs=v_cbs)


# 19. classify_item delega corretamente (mesma RtcClassification).
def test_classify_item_delega_para_classify_rtc_impact(
    make_item: Callable[..., FiscalItem],
) -> None:
    item = make_item(cfop="5102", v_ibs=POS_IBS, v_cbs=POS_CBS)
    result = classify_item(item, Direction.INBOUND)
    assert result == RtcClassification(RtcImpact.CREDIT, RtcReason.INBOUND)


def test_classify_item_propaga_exclusao_e_zero(
    make_item: Callable[..., FiscalItem],
) -> None:
    excluido = make_item(cfop="7101")
    assert classify_item(excluido, Direction.OUTBOUND) == RtcClassification(
        RtcImpact.NEUTRAL, RtcReason.EXCLUDED_CFOP
    )

    sem_destaque = make_item(cfop="5102", v_ibs=ZERO, v_cbs=ZERO)
    assert classify_item(sem_destaque, Direction.OUTBOUND) == RtcClassification(
        RtcImpact.NEUTRAL, RtcReason.NO_HIGHLIGHT
    )

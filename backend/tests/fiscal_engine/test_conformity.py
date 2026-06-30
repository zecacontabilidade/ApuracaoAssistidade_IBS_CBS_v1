"""Testes da avaliação de conformidade RTC (``fiscal_engine.conformity``).

Contrato F0.7b — uma asserção por linha da tabela de decisão, mais precedências
e provas anti-falso-negativo. Fixtures SINTÉTICAS (sem dado real de cliente).
"""

from collections.abc import Callable
from decimal import Decimal

import pytest

from fiscal_engine.conformity import assess_conformity, assess_item
from fiscal_engine.enums import (
    Conformity,
    ConformityReason,
    Direction,
    RtcReason,
    TaxRegime,
)
from fiscal_engine.models import FiscalItem, ItemConformity
from tests.fiscal_engine.conftest import PRE_RTC, RTC_VIGENCIA

POS_IBS = Decimal("8.80")
POS_CBS = Decimal("0.90")
ZERO = Decimal("0")


# --- Tabela de decisão: 1 caso por linha -------------------------------------


# 1) issue_date is None -> (NAO_AVALIADO, DATA_AUSENTE). Vale para QUALQUER reason.
def test_data_ausente_e_nao_avaliado() -> None:
    assert assess_conformity(
        reason=RtcReason.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        issue_date=None,
        cfop="5102",
    ) == (Conformity.NAO_AVALIADO, ConformityReason.DATA_AUSENTE)


# 2) issue_date < 2026-01-01 -> (NAO_AVALIADO, PRE_2026).
def test_pre_2026_e_nao_avaliado() -> None:
    assert assess_conformity(
        reason=RtcReason.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        issue_date=PRE_RTC,
        cfop="5102",
    ) == (Conformity.NAO_AVALIADO, ConformityReason.PRE_2026)


# 3) reason == UNKNOWN_DIRECTION -> (NAO_AVALIADO, DIRECAO_DESCONHECIDA).
def test_direcao_desconhecida_e_nao_avaliado() -> None:
    assert assess_conformity(
        reason=RtcReason.UNKNOWN_DIRECTION,
        tax_regime=TaxRegime.RPA,
        issue_date=RTC_VIGENCIA,
        cfop="5102",
    ) == (Conformity.NAO_AVALIADO, ConformityReason.DIRECAO_DESCONHECIDA)


# 4a) EXCLUDED_CFOP com 7.xxx (exceto 79) -> (CONFORME, EXPORTACAO_IMUNE).
#     Aceita CFOP com e sem ponto (normalização reusada de impact.py).
@pytest.mark.parametrize("cfop", ["7101", "7.101", "7201"])
def test_exportacao_imune_e_conforme(cfop: str) -> None:
    assert assess_conformity(
        reason=RtcReason.EXCLUDED_CFOP,
        tax_regime=TaxRegime.RPA,
        issue_date=RTC_VIGENCIA,
        cfop=cfop,
    ) == (Conformity.CONFORME, ConformityReason.EXPORTACAO_IMUNE)


# 4b) EXCLUDED_CFOP demais (79xx, 59, 69, 515, 615, len != 4, não-normalizável)
#     -> (NAO_AVALIADO, NAO_COMERCIAL).
@pytest.mark.parametrize("cfop", ["7930", "5910", "6915", "5152", "6152", "71010", None, "abc"])
def test_excluded_nao_exportacao_e_nao_comercial(cfop: str | None) -> None:
    assert assess_conformity(
        reason=RtcReason.EXCLUDED_CFOP,
        tax_regime=TaxRegime.RPA,
        issue_date=RTC_VIGENCIA,
        cfop=cfop,
    ) == (Conformity.NAO_AVALIADO, ConformityReason.NAO_COMERCIAL)


# 5) reason in {INBOUND, OUTBOUND} -> (CONFORME, DESTAQUE_PRESENTE).
@pytest.mark.parametrize("reason", [RtcReason.INBOUND, RtcReason.OUTBOUND])
def test_destaque_presente_e_conforme(reason: RtcReason) -> None:
    assert assess_conformity(
        reason=reason,
        tax_regime=TaxRegime.RPA,
        issue_date=RTC_VIGENCIA,
        cfop="5102",
    ) == (Conformity.CONFORME, ConformityReason.DESTAQUE_PRESENTE)


# 6) reason == NO_HIGHLIGHT -> ramifica por regime (1 caso por regime).
@pytest.mark.parametrize(
    ("regime", "expected"),
    [
        (TaxRegime.SIMPLES_NACIONAL, (Conformity.CONFORME, ConformityReason.REGIME_SIMPLES)),
        (TaxRegime.RPA, (Conformity.INCONFORMIDADE, ConformityReason.RPA_SEM_DESTAQUE)),
        (
            TaxRegime.SIMPLES_EXCESSO,
            (Conformity.INCONFORMIDADE, ConformityReason.SIMPLES_EXCESSO_SEM_DESTAQUE),
        ),
        (TaxRegime.MEI, (Conformity.NAO_AVALIADO, ConformityReason.REGIME_MEI)),
        (TaxRegime.UNKNOWN, (Conformity.NAO_AVALIADO, ConformityReason.REGIME_DESCONHECIDO)),
    ],
)
def test_no_highlight_ramifica_por_regime(
    regime: TaxRegime, expected: tuple[Conformity, ConformityReason]
) -> None:
    assert (
        assess_conformity(
            reason=RtcReason.NO_HIGHLIGHT,
            tax_regime=regime,
            issue_date=RTC_VIGENCIA,
            cfop="5102",
        )
        == expected
    )


# --- Precedências ------------------------------------------------------------


# issue_date None vence o regime (RPA sem destaque SERIA inconformidade).
def test_data_ausente_vence_regime() -> None:
    assert assess_conformity(
        reason=RtcReason.NO_HIGHLIGHT,
        tax_regime=TaxRegime.RPA,
        issue_date=None,
        cfop="5102",
    ) == (Conformity.NAO_AVALIADO, ConformityReason.DATA_AUSENTE)


# 2025 + 7101 -> PRE_2026 (NÃO EXPORTACAO_IMUNE): a vigência vence o CFOP.
def test_pre_2026_vence_exportacao_imune() -> None:
    assert assess_conformity(
        reason=RtcReason.EXCLUDED_CFOP,
        tax_regime=TaxRegime.RPA,
        issue_date=PRE_RTC,
        cfop="7101",
    ) == (Conformity.NAO_AVALIADO, ConformityReason.PRE_2026)


# --- Anti-falso-negativo: NÃO há whitelist de CFOP ---------------------------


# 5656/5202 são CFOPs comerciais não-excluídos. Saída RPA sem destaque chega como
# NO_HIGHLIGHT (F0.7a) e DEVE virar INCONFORMIDADE — prova que não há whitelist
# que "absolva" CFOPs específicos.
@pytest.mark.parametrize("cfop", ["5656", "5202"])
def test_rpa_saida_sem_destaque_e_inconformidade_sem_whitelist(
    make_item: Callable[..., FiscalItem], cfop: str
) -> None:
    item = make_item(cfop=cfop, v_ibs=ZERO, v_cbs=ZERO)
    result = assess_item(
        item,
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        issue_date=RTC_VIGENCIA,
    )
    assert result == ItemConformity(
        item_number=item.item_number,
        conformity=Conformity.INCONFORMIDADE,
        reason=ConformityReason.RPA_SEM_DESTAQUE,
        direction=Direction.OUTBOUND,
    )


# --- assess_item: carimba direção e veredito é direction-simétrico -----------


def test_assess_item_carimba_direction_e_veredito_simetrico(
    make_item: Callable[..., FiscalItem],
) -> None:
    item = make_item(item_number=7, cfop="5102", v_ibs=ZERO, v_cbs=ZERO)
    inbound = assess_item(
        item, direction=Direction.INBOUND, tax_regime=TaxRegime.RPA, issue_date=RTC_VIGENCIA
    )
    outbound = assess_item(
        item, direction=Direction.OUTBOUND, tax_regime=TaxRegime.RPA, issue_date=RTC_VIGENCIA
    )
    # Veredito IDÊNTICO nas duas direções (direction-simétrico)...
    assert inbound.conformity == outbound.conformity == Conformity.INCONFORMIDADE
    assert inbound.reason == outbound.reason == ConformityReason.RPA_SEM_DESTAQUE
    assert inbound.item_number == outbound.item_number == 7
    # ...mas a DIREÇÃO é carimbada distintamente (para a mensagem §5.4).
    assert inbound.direction == Direction.INBOUND
    assert outbound.direction == Direction.OUTBOUND


def test_assess_item_destaque_presente_conforme(
    make_item: Callable[..., FiscalItem],
) -> None:
    item = make_item(cfop="5102", v_ibs=POS_IBS, v_cbs=POS_CBS)
    result = assess_item(
        item, direction=Direction.INBOUND, tax_regime=TaxRegime.RPA, issue_date=RTC_VIGENCIA
    )
    assert result.conformity == Conformity.CONFORME
    assert result.reason == ConformityReason.DESTAQUE_PRESENTE


def test_assess_item_propaga_cfop_para_exportacao_imune(
    make_item: Callable[..., FiscalItem],
) -> None:
    # Garante que o assess_item passa o item.cfop adiante (ramo EXCLUDED_CFOP).
    item = make_item(cfop="7101", v_ibs=POS_IBS, v_cbs=POS_CBS)
    result = assess_item(
        item, direction=Direction.OUTBOUND, tax_regime=TaxRegime.RPA, issue_date=RTC_VIGENCIA
    )
    assert result.conformity == Conformity.CONFORME
    assert result.reason == ConformityReason.EXPORTACAO_IMUNE

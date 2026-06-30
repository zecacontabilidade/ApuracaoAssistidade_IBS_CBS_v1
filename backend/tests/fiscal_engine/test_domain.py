"""Testes do domínio puro: enums, imutabilidade e exatidão monetária."""

import dataclasses
from collections.abc import Callable
from decimal import Decimal
from enum import StrEnum

import pytest

from fiscal_engine.enums import (
    Conformity,
    ConformityReason,
    Direction,
    DocumentPurpose,
    DocumentType,
    Granularity,
    RtcImpact,
    RtcReason,
    TaxRegime,
)
from fiscal_engine.models import FiscalDocument, FiscalItem


# 20. Cada enum tem EXATAMENTE os membros especificados no contrato.
@pytest.mark.parametrize(
    ("enum_cls", "expected_names"),
    [
        (RtcImpact, {"CREDIT", "DEBIT", "NEUTRAL"}),
        (Direction, {"INBOUND", "OUTBOUND", "UNKNOWN"}),
        (DocumentType, {"NFE", "NFCE", "CTE", "NFSE", "UNKNOWN"}),
        # F0.7b: TaxRegime ganhou SIMPLES_EXCESSO (excesso de sublimite).
        (TaxRegime, {"RPA", "SIMPLES_NACIONAL", "SIMPLES_EXCESSO", "MEI", "UNKNOWN"}),
        (DocumentPurpose, {"NORMAL", "COMPLEMENTAR", "AJUSTE", "DEVOLUCAO"}),
        (
            RtcReason,
            {"INBOUND", "OUTBOUND", "EXCLUDED_CFOP", "NO_HIGHLIGHT", "UNKNOWN_DIRECTION"},
        ),
        # F0.7b: enums de conformidade e granularidade.
        (Conformity, {"CONFORME", "INCONFORMIDADE", "NAO_AVALIADO"}),
        (
            ConformityReason,
            {
                "DATA_AUSENTE",
                "PRE_2026",
                "DIRECAO_DESCONHECIDA",
                "NAO_COMERCIAL",
                "EXPORTACAO_IMUNE",
                "DESTAQUE_PRESENTE",
                "REGIME_SIMPLES",
                "REGIME_MEI",
                "REGIME_DESCONHECIDO",
                "RPA_SEM_DESTAQUE",
                "SIMPLES_EXCESSO_SEM_DESTAQUE",
            },
        ),
        (Granularity, {"MONTHLY", "QUARTERLY"}),
    ],
)
def test_enum_tem_membros_exatos(enum_cls: type[StrEnum], expected_names: set[str]) -> None:
    assert {member.name for member in enum_cls} == expected_names


def test_rtc_impact_e_str_enum() -> None:
    """``StrEnum``: o valor coincide com o nome e compara como string."""
    assert RtcImpact.CREDIT == "CREDIT"
    assert RtcImpact.CREDIT.value == "CREDIT"


# 21. FiscalItem/FiscalDocument são imutáveis (frozen).
def test_fiscal_item_e_imutavel(make_item: Callable[..., FiscalItem]) -> None:
    item = make_item()
    with pytest.raises(dataclasses.FrozenInstanceError):
        item.v_ibs = Decimal("999")  # type: ignore[misc]


def test_fiscal_document_e_imutavel(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document()
    with pytest.raises(dataclasses.FrozenInstanceError):
        doc.direction = Direction.OUTBOUND  # type: ignore[misc]


def test_modelos_usam_slots() -> None:
    """``slots=True`` impede atribuição de atributos não declarados."""
    assert FiscalItem.__slots__
    assert FiscalDocument.__slots__


# 22. Decimal preservado sem coerção para float.
def test_decimal_preservado_no_item(make_item: Callable[..., FiscalItem]) -> None:
    item = make_item(v_ibs=Decimal("0.01"), v_cbs=Decimal("0.02"))
    assert isinstance(item.v_ibs, Decimal)
    assert isinstance(item.v_cbs, Decimal)
    assert item.v_ibs == Decimal("0.01")
    assert item.v_cbs == Decimal("0.02")


def test_soma_de_destaque_permanece_decimal(
    make_item: Callable[..., FiscalItem],
) -> None:
    item = make_item(v_ibs=Decimal("0.01"), v_cbs=Decimal("0.02"))
    total = item.v_ibs + item.v_cbs
    assert isinstance(total, Decimal)
    # 0.01 + 0.02 == 0.03 exato em Decimal (em float daria 0.030000000000000002).
    assert total == Decimal("0.03")


def test_defaults_monetarios_sao_decimal() -> None:
    item = FiscalItem(item_number=1)
    assert isinstance(item.gross_value, Decimal)
    assert item.gross_value == Decimal("0")
    assert item.net_value is None

    doc = FiscalDocument(document_type=DocumentType.NFE, direction=Direction.UNKNOWN)
    assert isinstance(doc.total_value, Decimal)
    assert doc.tax_regime is TaxRegime.UNKNOWN
    assert doc.items == ()

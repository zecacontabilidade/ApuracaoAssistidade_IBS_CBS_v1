"""Fixtures SINTÉTICAS para os testes do motor fiscal.

IMPORTANTE (LGPD / CLAUDE.md): nenhum dado real de cliente. Todas as chaves de
acesso, valores e CFOPs são inventados apenas para exercitar a regra. As chaves
de acesso fictícias usam o sufixo evidente "0000...0001" e NÃO correspondem a
documentos reais.
"""

from collections.abc import Callable
from datetime import date
from decimal import Decimal

import pytest

from fiscal_engine.enums import (
    Direction,
    DocumentPurpose,
    DocumentType,
    TaxRegime,
)
from fiscal_engine.models import FiscalDocument, FiscalItem

# Chave de acesso fictícia (44 dígitos) — claramente sintética.
SYNTHETIC_ACCESS_KEY = "0" * 43 + "1"

# -----------------------------------------------------------------------------
# Datas-âncora da vigência RTC (LC 214/2025): o regime IBS/CBS inicia em 2026.
# Usadas pela conformidade (F0.7b) para classificar documentos fora de vigência
# como NAO_AVALIADO (DATA_AUSENTE / PRE_2026).
# -----------------------------------------------------------------------------
RTC_VIGENCIA = date(2026, 1, 1)  # primeiro dia de vigência (CONFORME se aplica)
PRE_RTC = date(2025, 12, 31)  # último dia anterior — força PRE_2026

# Regimes em que SAÍDA comercial sem destaque é INCONFORMIDADE (F0.7b).
REGIMES_INCONFORMES = (TaxRegime.RPA, TaxRegime.SIMPLES_EXCESSO)


def synthetic_access_key(suffix: int) -> str:
    """Chave de acesso fictícia de 44 dígitos com sufixo DISTINTO.

    Permite múltiplos documentos sintéticos com chaves diferentes (ex.: testes de
    multi-documento e de NÃO-deduplicação). LGPD: 100% inventada, NUNCA real.
    """
    return str(suffix).rjust(44, "0")


@pytest.fixture
def make_item() -> Callable[..., FiscalItem]:
    """Fábrica de ``FiscalItem`` sintético com defaults seguros.

    Sobrescreva apenas os campos relevantes para cada caso de teste.
    """

    def _make(
        *,
        item_number: int = 1,
        description: str | None = "Item sintético de teste",
        cfop: str | None = "5102",
        ncm: str | None = "00000000",
        gross_value: Decimal = Decimal("100.00"),
        net_value: Decimal | None = None,
        v_bc: Decimal = Decimal("100.00"),
        v_ibs: Decimal = Decimal("8.80"),
        v_cbs: Decimal = Decimal("0.90"),
        cst: str | None = "000",
    ) -> FiscalItem:
        return FiscalItem(
            item_number=item_number,
            description=description,
            cfop=cfop,
            ncm=ncm,
            gross_value=gross_value,
            net_value=net_value,
            v_bc=v_bc,
            v_ibs=v_ibs,
            v_cbs=v_cbs,
            cst=cst,
        )

    return _make


@pytest.fixture
def make_document(
    make_item: Callable[..., FiscalItem],
) -> Callable[..., FiscalDocument]:
    """Fábrica de ``FiscalDocument`` sintético com defaults seguros."""

    def _make(
        *,
        document_type: DocumentType = DocumentType.NFE,
        direction: Direction = Direction.INBOUND,
        tax_regime: TaxRegime = TaxRegime.RPA,
        access_key: str | None = SYNTHETIC_ACCESS_KEY,
        issue_date: date | None = date(2026, 1, 1),
        purpose: DocumentPurpose | None = DocumentPurpose.NORMAL,
        cfop: str | None = "5102",
        total_value: Decimal = Decimal("100.00"),
        v_bc_ibscbs: Decimal = Decimal("100.00"),
        v_ibs: Decimal = Decimal("8.80"),
        v_cbs: Decimal = Decimal("0.90"),
        items: tuple[FiscalItem, ...] | None = None,
    ) -> FiscalDocument:
        return FiscalDocument(
            document_type=document_type,
            direction=direction,
            tax_regime=tax_regime,
            access_key=access_key,
            issue_date=issue_date,
            purpose=purpose,
            cfop=cfop,
            total_value=total_value,
            v_bc_ibscbs=v_bc_ibscbs,
            v_ibs=v_ibs,
            v_cbs=v_cbs,
            items=(make_item(),) if items is None else items,
        )

    return _make

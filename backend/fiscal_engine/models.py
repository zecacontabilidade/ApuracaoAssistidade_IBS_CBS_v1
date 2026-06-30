"""Modelos de domínio do motor fiscal IBS/CBS (domínio puro).

Princípios (CLAUDE.md / contrato F0.7a):
- SEM IO, SEM FastAPI, SEM SQLAlchemy/ORM, SEM Pydantic.
- ``dataclass(frozen=True, slots=True)`` — imutável e econômico em memória.
- Dinheiro SEMPRE ``Decimal``, NUNCA ``float`` (preserva centavos sem erro de
  ponto flutuante).
- LGPD by design (minimização): o domínio do engine NÃO carrega campos de
  identidade DIRETOS (sem razão social nem CNPJ avulso de emitente/destinatário).
  ATENÇÃO: ``access_key`` (chave de acesso de 44 dígitos, preenchida pelo parser
  F1.5) é um identificador INDIRETO — embute o CNPJ do emitente (dígitos 7-20) —
  e dado comercialmente sensível; deve ser protegido na persistência, transporte
  e logs (RLS, cripto, mascaramento) a partir de F1.5/F1.6. A regra de impacto
  (``classify_rtc_impact``) não recebe identidade alguma — apenas ``direction``,
  ``cfop``, ``v_ibs``, ``v_cbs`` (minimização / LGPD by design).
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from fiscal_engine.enums import (
    Direction,
    DocumentPurpose,
    DocumentType,
    RtcImpact,
    RtcReason,
    TaxRegime,
)


@dataclass(frozen=True, slots=True)
class RtcClassification:
    """Resultado da classificação de impacto RTC: par (impacto, motivo)."""

    impact: RtcImpact
    reason: RtcReason


@dataclass(frozen=True, slots=True)
class FiscalItem:
    """Item de um documento fiscal — INPUT puro do motor.

    NÃO carrega ``rtc_impact``: o impacto é SAÍDA do motor (calculado por
    ``classify_item``), nunca um campo do input. Valores monetários em
    ``Decimal``.
    """

    item_number: int
    description: str | None = None
    cfop: str | None = None
    ncm: str | None = None
    gross_value: Decimal = Decimal("0")
    net_value: Decimal | None = None
    v_bc: Decimal = Decimal("0")
    v_ibs: Decimal = Decimal("0")
    v_cbs: Decimal = Decimal("0")
    cst: str | None = None


@dataclass(frozen=True, slots=True)
class FiscalDocument:
    """Documento fiscal eletrônico — INPUT puro do motor.

    A ``direction`` já vem CALCULADA pelo parser (F1.5); o engine apenas
    consome. ``items`` é uma ``tuple`` (imutável) para manter a instância
    inteiramente congelada.

    Sem campos de identidade DIRETOS (sem razão social nem CNPJ avulso de
    emitente/destinatário). ATENÇÃO: ``access_key`` (chave de acesso de 44
    dígitos, preenchida pelo parser F1.5) é um identificador INDIRETO — embute o
    CNPJ do emitente (dígitos 7-20) — e dado comercialmente sensível; deve ser
    protegido na persistência, transporte e logs (RLS, cripto, mascaramento) a
    partir de F1.5/F1.6.
    """

    document_type: DocumentType
    direction: Direction
    tax_regime: TaxRegime = TaxRegime.UNKNOWN
    access_key: str | None = None
    issue_date: date | None = None
    purpose: DocumentPurpose | None = None
    cfop: str | None = None
    total_value: Decimal = Decimal("0")
    v_bc_ibscbs: Decimal = Decimal("0")
    v_ibs: Decimal = Decimal("0")
    v_cbs: Decimal = Decimal("0")
    items: tuple[FiscalItem, ...] = ()

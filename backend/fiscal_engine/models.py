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


@dataclass(frozen=True, slots=True)
class ItemConformity:
    """Veredito de conformidade de UMA unidade aferível (F0.7b).

    SAÍDA de ``assess_item``. ``direction`` é carimbada do documento para que a
    camada de apresentação monte a mensagem específica (§5.4); o VEREDITO em si é
    direction-simétrico (a mesma combinação reason/regime gera o mesmo par
    conformity/reason em INBOUND ou OUTBOUND).
    """

    item_number: int
    conformity: Conformity
    reason: ConformityReason
    direction: Direction


@dataclass(frozen=True, slots=True)
class InconformidadeRef:
    """Referência rastreável a uma unidade em INCONFORMIDADE (F0.7b).

    Aponta para a unidade-origem do indício dentro da apuração, sem duplicar o
    documento. LGPD: ``access_key`` é identificador INDIRETO (embute o CNPJ do
    emitente, dígitos 7-20) — apenas REFERÊNCIA para drill-down; deve ser
    protegido na persistência/transporte/logs (RLS, cripto, mascaramento). Pode
    ser ``None`` quando o documento não trouxe a chave (ex.: NFS-e/avulso).
    """

    access_key: str | None
    item_number: int
    direction: Direction
    cfop: str | None
    reason: ConformityReason


@dataclass(frozen=True, slots=True)
class Apuracao:
    """Resultado agregado da apuração de IBS/CBS de um conjunto de documentos.

    SAÍDA de ``apurar`` — domínio PURO (sem versão de engine nem snapshot de
    parâmetros: esses são da camada de repositório, que persiste a apuração).
    Todo dinheiro é ``Decimal`` quantizado a 2 casas (ROUND_HALF_UP).

    Eixos CANÔNICOS (fonte da liquidação, NÃO cruzam IBS x CBS — tributos com
    apuração independente, LC 214/2025):
    ``creditos_ibs``/``creditos_cbs``, ``debitos_ibs``/``debitos_cbs``,
    ``saldo_ibs = creditos_ibs - debitos_ibs`` e
    ``saldo_cbs = creditos_cbs - debitos_cbs``.

    AGREGADOS (``creditos``/``debitos``/``saldo`` = soma IBS+CBS) existem APENAS
    para exibição/indicadores — NUNCA para liquidação (somar IBS com CBS não tem
    efeito tributário). ``period_start``/``period_end``/``granularity`` são
    METADADOS (o caller já selecionou e deduplicou os documentos do período).

    Índices em pontos percentuais (``Decimal`` 2 casas) ou ``None`` quando a base
    é zero — NUNCA 0 nem exceção, para não confundir "sem base" com "zero por
    cento".
    """

    period_start: date | None
    period_end: date | None
    granularity: Granularity

    # Eixos canônicos (liquidação) — IBS e CBS separados.
    creditos_ibs: Decimal
    creditos_cbs: Decimal
    debitos_ibs: Decimal
    debitos_cbs: Decimal
    saldo_ibs: Decimal
    saldo_cbs: Decimal

    # Agregados (exibição/indicadores) — NUNCA liquidação.
    creditos: Decimal
    debitos: Decimal
    saldo: Decimal

    # Bases (universo comercial).
    base_entradas: Decimal
    base_saidas: Decimal

    # Indicadores (pontos percentuais) — None quando a base é zero.
    idx_credito_entradas: Decimal | None
    idx_debito_saidas: Decimal | None
    idx_saldo_saidas: Decimal | None
    idx_saldo_saidas_ibs: Decimal | None
    idx_saldo_saidas_cbs: Decimal | None

    # Contagens de conformidade (por unidade aferível).
    conforme_count: int
    inconformidade_count: int
    nao_avaliado_count: int

    # Contagens de volume.
    documentos_count: int
    itens_count: int

    # Drill-down das inconformidades.
    inconformidades: tuple[InconformidadeRef, ...]

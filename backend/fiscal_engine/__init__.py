"""Motor fiscal IBS/CBS — domínio puro (RTC, LC 214/2025 / EC 132).

Pacote TOP-LEVEL (``from fiscal_engine import ...``). Não depende de FastAPI,
banco, Pydantic nem IO.

LGPD by design (minimização): o domínio do engine não carrega campos de
identidade DIRETOS (sem razão social nem CNPJ avulso de emitente/destinatário).
ATENÇÃO: ``access_key`` (chave de acesso de 44 dígitos, preenchida pelo parser
F1.5) é um identificador INDIRETO — embute o CNPJ do emitente (dígitos 7-20) — e
dado comercialmente sensível; deve ser protegido na persistência, transporte e
logs (RLS, cripto, mascaramento) a partir de F1.5/F1.6. A regra de impacto
(``classify_rtc_impact``) não recebe identidade alguma — apenas ``direction``,
``cfop``, ``v_ibs``, ``v_cbs``.

Símbolos públicos: enums de classificação, modelos de domínio imutáveis e a
regra de impacto RTC (crédito/débito/neutro).
"""

from fiscal_engine.enums import (
    Direction,
    DocumentPurpose,
    DocumentType,
    RtcImpact,
    RtcReason,
    TaxRegime,
)
from fiscal_engine.impact import (
    CFOP_EXCLUDED_PREFIXES,
    classify_item,
    classify_rtc_impact,
    is_excluded_cfop,
)
from fiscal_engine.models import FiscalDocument, FiscalItem, RtcClassification

__all__ = [
    "CFOP_EXCLUDED_PREFIXES",
    "Direction",
    "DocumentPurpose",
    "DocumentType",
    "FiscalDocument",
    "FiscalItem",
    "RtcClassification",
    "RtcImpact",
    "RtcReason",
    "TaxRegime",
    "classify_item",
    "classify_rtc_impact",
    "is_excluded_cfop",
]

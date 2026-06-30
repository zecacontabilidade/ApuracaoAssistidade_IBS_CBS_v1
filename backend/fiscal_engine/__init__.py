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

Símbolos públicos: enums de classificação/conformidade, modelos de domínio
imutáveis, a regra de impacto RTC (crédito/débito/neutro), a avaliação de
conformidade (F0.7b) e a apuração agregada de IBS/CBS (F0.7b).
"""

from fiscal_engine.apuracao import apurar
from fiscal_engine.conformity import assess_conformity, assess_item
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
from fiscal_engine.impact import (
    CFOP_EXCLUDED_PREFIXES,
    classify_item,
    classify_rtc_impact,
    is_excluded_cfop,
)
from fiscal_engine.models import (
    Apuracao,
    FiscalDocument,
    FiscalItem,
    InconformidadeRef,
    ItemConformity,
    RtcClassification,
)

__all__ = [
    "CFOP_EXCLUDED_PREFIXES",
    "Apuracao",
    "Conformity",
    "ConformityReason",
    "Direction",
    "DocumentPurpose",
    "DocumentType",
    "FiscalDocument",
    "FiscalItem",
    "Granularity",
    "InconformidadeRef",
    "ItemConformity",
    "RtcClassification",
    "RtcImpact",
    "RtcReason",
    "TaxRegime",
    "apurar",
    "assess_conformity",
    "assess_item",
    "classify_item",
    "classify_rtc_impact",
    "is_excluded_cfop",
]

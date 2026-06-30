"""Enumerações do motor fiscal IBS/CBS (domínio puro).

Base normativa
--------------
- LC 214/2025 / EC 132 (Reforma Tributária do Consumo — RTC): IBS/CBS,
  não-cumulatividade plena e imunidade das exportações.
- SPEC_XML_MAPPING_v2.md — regra de direção e papel do CFOP (filtro de
  operações não-comerciais; CFOP NÃO dirige crédito/débito).
- SPEC_BUSINESS_RULES.md — fornecedor Simples Nacional sem destaque = NEUTRAL.
- docs/data-model.md — `RtcImpact ∈ {CREDIT, DEBIT, NEUTRAL}` (saída do motor).

Todos os enums são ``StrEnum`` (Python 3.11+): o valor textual coincide com o
nome, o que simplifica serialização determinística na camada de persistência
sem acoplar o domínio a ela.
"""

from enum import StrEnum


class RtcImpact(StrEnum):
    """Impacto RTC de um item/documento na apuração de IBS/CBS.

    Saída do motor fiscal. São EXATAMENTE três valores (docs/data-model.md):
    crédito (entrada que gera crédito), débito (saída que gera débito) ou
    neutro (não gera crédito nem débito).

    NÃO inclui ``INCONFORMIDADE``: conformidade é responsabilidade da fatia
    F0.7b, que distingue NEUTRAL-esperado de candidato a inconformidade a
    partir de ``RtcReason`` — sem recomputar o impacto.
    """

    CREDIT = "CREDIT"
    DEBIT = "DEBIT"
    NEUTRAL = "NEUTRAL"


class Direction(StrEnum):
    """Sentido ECONÔMICO da operação em relação ao CNPJ-raiz analisado.

    Representa entrada (INBOUND) ou saída (OUTBOUND) ECONÔMICA do CNPJ-raiz
    sob análise — NÃO a posição bruta emitente/destinatário do XML. O cálculo
    de direção (a partir de ``tpNF``/``finNFe`` combinados com a posição do
    CNPJ-raiz no documento) pertence ao parser da fatia F1.5; o engine apenas
    CONSOME o resultado já calculado.

    Essa separação evita inverter o sinal em notas de entrada auto-emitidas,
    como devolução de venda (CFOP 1.2xx) e importação (CFOP 3.1xx), nas quais
    a posição bruta emitente/destinatário não corresponde ao sentido econômico.

    ``UNKNOWN`` cobre o caso em que o parser não conseguiu determinar a direção
    — o engine trata como NEUTRAL (ver ``classify_rtc_impact``).
    """

    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    UNKNOWN = "UNKNOWN"


class DocumentType(StrEnum):
    """Tipo de documento fiscal eletrônico (metadado de classificação)."""

    NFE = "NFE"
    NFCE = "NFCE"
    CTE = "CTE"
    NFSE = "NFSE"
    UNKNOWN = "UNKNOWN"


class TaxRegime(StrEnum):
    """Regime tributário inferido do documento.

    Definido por COMPLETUDE dos dados (ex.: presença/ausência de destaque de
    IBS/CBS), NÃO é entrada da regra de impacto. O regime serve a relatórios e
    à análise de mix de fornecedores; a regra de impacto depende apenas de
    direção, CFOP e valores destacados.
    """

    RPA = "RPA"
    SIMPLES_NACIONAL = "SIMPLES_NACIONAL"
    MEI = "MEI"
    UNKNOWN = "UNKNOWN"


class DocumentPurpose(StrEnum):
    """Finalidade do documento (``infNFe.ide.finNFe``): metadado informativo.

    NÃO é usado pela regra de impacto — mantido para relatórios e trilha.
    """

    NORMAL = "NORMAL"
    COMPLEMENTAR = "COMPLEMENTAR"
    AJUSTE = "AJUSTE"
    DEVOLUCAO = "DEVOLUCAO"


class RtcReason(StrEnum):
    """Motivo que justifica o ``RtcImpact`` atribuído.

    Permite à fatia F0.7b distinguir um NEUTRAL-esperado (ex.: CFOP excluído,
    direção desconhecida) de um candidato a INCONFORMIDADE (saída/entrada
    comercial sem destaque de IBS/CBS) SEM recomputar a classificação.
    """

    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    EXCLUDED_CFOP = "EXCLUDED_CFOP"
    NO_HIGHLIGHT = "NO_HIGHLIGHT"
    UNKNOWN_DIRECTION = "UNKNOWN_DIRECTION"

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
    IBS/CBS), NÃO é entrada da regra de impacto (``classify_rtc_impact`` é
    regime-agnóstica — ADR 0009). O regime serve a relatórios, à análise de mix
    de fornecedores e à CONFORMIDADE (F0.7b): só ele distingue, num documento sem
    destaque, o NEUTRAL-esperado do Simples da inconformidade do RPA.

    ``SIMPLES_EXCESSO`` (F0.7b): contribuinte do Simples Nacional que ultrapassou
    o sublimite de receita e passa a apurar IBS/CBS por fora (LC 214/2025, regime
    de transição) — logo, saída sem destaque é candidata a inconformidade, como
    no RPA. Distinto de ``SIMPLES_NACIONAL`` (dentro do sublimite: sem destaque é
    esperado/conforme).
    """

    RPA = "RPA"
    SIMPLES_NACIONAL = "SIMPLES_NACIONAL"
    SIMPLES_EXCESSO = "SIMPLES_EXCESSO"
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


class Conformity(StrEnum):
    """Veredito de conformidade de uma unidade aferível (F0.7b).

    Camada SOBRE o ``RtcReason`` da F0.7a — NÃO recomputa impacto. Distingue:

    - ``CONFORME``: comportamento esperado (destaque presente onde devido,
      exportação imune, ausência de destaque legítima do Simples).
    - ``INCONFORMIDADE``: indício acionável (saída comercial de RPA / Simples em
      excesso de sublimite SEM destaque de IBS/CBS).
    - ``NAO_AVALIADO``: fora do alcance da regra nesta fatia (data ausente,
      período pré-2026, direção desconhecida, operação não-comercial, MEI/regime
      desconhecido). Conservador — evita falso positivo (ADR 0010).
    """

    CONFORME = "CONFORME"
    INCONFORMIDADE = "INCONFORMIDADE"
    NAO_AVALIADO = "NAO_AVALIADO"


class ConformityReason(StrEnum):
    """Motivo que justifica o veredito de ``Conformity`` (F0.7b).

    Permite à camada de apresentação (§5.4) montar mensagem específica sem
    reinspecionar o documento. Mapa de motivos → veredito:

    - ``DATA_AUSENTE``/``PRE_2026`` → NAO_AVALIADO (fora da vigência RTC: o
      regime IBS/CBS só se inicia em 2026, LC 214/2025).
    - ``DIRECAO_DESCONHECIDA`` → NAO_AVALIADO (parser não definiu o sentido).
    - ``NAO_COMERCIAL`` → NAO_AVALIADO (CFOP excluído não-exportação: remessas,
      transferências, brindes).
    - ``EXPORTACAO_IMUNE`` → CONFORME (exportação 7.xxx, exceto 79xx; imune por
      EC 132 / LC 214/2025).
    - ``DESTAQUE_PRESENTE`` → CONFORME (entrada/saída comercial com IBS/CBS).
    - ``REGIME_SIMPLES`` → CONFORME (Simples dentro do sublimite: sem destaque é
      esperado).
    - ``RPA_SEM_DESTAQUE``/``SIMPLES_EXCESSO_SEM_DESTAQUE`` → INCONFORMIDADE
      (operação comercial sem o destaque devido).
    - ``REGIME_MEI`` → NAO_AVALIADO (conservador — pendência SME P3).
    - ``REGIME_DESCONHECIDO`` → NAO_AVALIADO (regime não inferido).
    """

    DATA_AUSENTE = "DATA_AUSENTE"
    PRE_2026 = "PRE_2026"
    DIRECAO_DESCONHECIDA = "DIRECAO_DESCONHECIDA"
    NAO_COMERCIAL = "NAO_COMERCIAL"
    EXPORTACAO_IMUNE = "EXPORTACAO_IMUNE"
    DESTAQUE_PRESENTE = "DESTAQUE_PRESENTE"
    REGIME_SIMPLES = "REGIME_SIMPLES"
    REGIME_MEI = "REGIME_MEI"
    REGIME_DESCONHECIDO = "REGIME_DESCONHECIDO"
    RPA_SEM_DESTAQUE = "RPA_SEM_DESTAQUE"
    SIMPLES_EXCESSO_SEM_DESTAQUE = "SIMPLES_EXCESSO_SEM_DESTAQUE"


class Granularity(StrEnum):
    """Granularidade do período de apuração (F0.7b).

    Metadado do resultado de ``apurar`` — NÃO altera o cálculo (o caller já
    selecionou os documentos do período). ``MONTHLY`` (apuração mensal de IBS/CBS,
    LC 214/2025) e ``QUARTERLY`` (visões trimestrais/gerenciais).
    """

    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"

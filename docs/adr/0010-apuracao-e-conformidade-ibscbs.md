# ADR 0010 — Apuração e conformidade IBS/CBS: saldo separado, índices e modelo de conformidade (F0.7b)

- **Status:** Aceito
- **Data:** 2026-06-30
- **Decisores:** arquiteto-lider (com engenheiro-motor-fiscal, oficial-lgpd)
- **Relacionados:** 0009 (impacto RTC), 0004 (fiscal_engine), `docs/data-model.md`
  (tabelas apuracoes e fiscal_document_items), `docs/regras-negocio-fiscais.md`
  (regras F0.7b), `/workspace/backend/fiscal_engine/apuracao.py`,
  `/workspace/backend/fiscal_engine/conformity.py`, SPEC_BUSINESS_RULES.md §6,
  LC 214/2025 / EC 132 (RTC).

## Contexto

A fatia F0.7b implementa o segundo pilar do motor fiscal: **apuração** (agregação
de créditos/débitos por período) e **conformidade** (marca se o item/documento
segue as regras esperadas ou é inconformidade). F0.7a entregou apenas a
classificação de impacto por item (CREDIT/DEBIT/NEUTRAL); F0.7b avança para:

1. **Saldo acumulado separado** de IBS e CBS (pois têm não-cumulatividade distinta).
2. **Índices** de apuração (crédito de entradas, débito de saídas, saldo líquido),
   com divisão-por-zero robusta e arredondamento Banker's Half-Up.
3. **Conformidade** como predicado (CONFORME / INCONFORMIDADE / NAO_AVALIADO) com
   tabela de decisão clara de precedência por data, regime, destaque e CFOP.
4. **Fonte única de "comercial"** (a classificação de reason de F0.7a) sem whitelist
   adicional de CFOP — mas com inspeção de exportação/CFOP excluso via 7.1xx/7.9xx
   no split conformidade/não-conformidade.
5. **Mapeamento CRT → TaxRegime** (CRT 1→SN, 2→SIMPLES_EXCESSO, 3→RPA, 4→MEI)
   baseado em contrato de parser F1.5/SME, pois NF-e não carrega `opSimpNac`.
6. **Tratamento MEI conservador** (NAO_AVALIADO até SME confirmar) e UNKNOWN como
   regime standby.
7. **Doc-level apuração** para CT-e (Conhecimento de Transporte) quando itens
   vazios (preserva crédito de frete).
8. **Engine puro** (sem IO, FastAPI, ORM, Pydantic; Decimal sempre; dataclasses
   frozen+slots) e **conformidade agnóstica à aplicação** — engine entrega saída,
   repositório cuida de persistência/auditoria.

## Decisão

### 1. Saldo IBS e CBS SEPARADO

Estrutura canônica de saída de apuração (campos FLAT, sem classe `IndicesApuracao`):

```python
@dataclass(frozen=True, slots=True)
class Apuracao:
    period_start: date | None
    period_end: date | None
    granularity: Granularity
    # Eixos canônicos (liquidação) — IBS e CBS separados.
    creditos_ibs: Decimal     # Σ v_ibs onde impact==CREDIT
    creditos_cbs: Decimal     # Σ v_cbs onde impact==CREDIT
    debitos_ibs: Decimal      # Σ v_ibs onde impact==DEBIT
    debitos_cbs: Decimal      # Σ v_cbs onde impact==DEBIT
    saldo_ibs: Decimal        # creditos_ibs - debitos_ibs
    saldo_cbs: Decimal        # creditos_cbs - debitos_cbs
    # Agregados (exibição/indicadores — NUNCA liquidação)
    creditos: Decimal         # creditos_ibs + creditos_cbs (só para exibição)
    debitos: Decimal          # debitos_ibs + debitos_cbs (só para exibição)
    saldo: Decimal            # saldo_ibs + saldo_cbs (só para exibição)
    # Bases (universo comercial).
    base_entradas: Decimal
    base_saidas: Decimal
```

**Razão:** IBS e CBS têm **não-cumulatividade distinta** — IBS veda compensação
total em determinados períodos (manutenção de crédito em exportação, ex.); CBS
pode ter regime diferente. Agregá-los mascara liquidação correta. Caso 3 da
especificação comprova: um saldo agregado erroneamente positivo pode ocultar um
déficit em um tributo específico.

**Nota:** Os agregados (`creditos`/`debitos`/`saldo`) existem
apenas como **derivado de exibição e insumo de cálculo de índice**, NUNCA como
figura de liquidação. A liquidação exige desagregar novamente antes de submeter
ao fisco.

### 2. Índices (§6.2 da spec)

Índices calculados como percentuais, embutidos em `Apuracao` (não há classe separada):

```python
# Indicadores (pontos percentuais) — None quando a base é zero.
idx_credito_entradas: Decimal | None        # creditos / base_entradas * 100
idx_debito_saidas: Decimal | None           # debitos / base_saidas * 100
idx_saldo_saidas: Decimal | None            # saldo / base_saidas * 100
idx_saldo_saidas_ibs: Decimal | None        # saldo_ibs / base_saidas * 100
idx_saldo_saidas_cbs: Decimal | None        # saldo_cbs / base_saidas * 100
```

**Nota:** Apenas SALDO tem variante por tributo (ibs/cbs); crédito e débito NÃO têm
variante (agregados de exibição, nunca segregados para índice).

**Base:** v_bc (valor da base de cálculo IBS/CBS, §2.3 da spec — já destacado
por parser F1.5 em `FiscalItem.v_bc`). Separado por direção (entradas vs. saídas).

**Divisão por zero → None:** Se base == 0, índice é `None` (distinto de 0.0).
Honra desconhecimento em vez de arredondar falsamente.

**Arredondamento:** HALF_UP a 2 casas decimais (padrão fiscal brasileiro,
Decimal.ROUND_HALF_UP). Aplicado após divisão e antes de retorno.

**Sinal do saldo:** idx_saldo_* carrega sinal (positivo = crédito disponível,
negativo = déficit). Não é |Saldo|.

### 3. Conformidade: Tabela de Decisão Fixa (precedência EXATA)

Enums (StrEnum, valores em MAIUSCULAS):

```python
class Conformity(StrEnum):
    CONFORME = "CONFORME"
    INCONFORMIDADE = "INCONFORMIDADE"
    NAO_AVALIADO = "NAO_AVALIADO"

class ConformityReason(StrEnum):
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
```

**Função de avaliação (keyword-only):**

```python
def assess_conformity(
    *,
    reason: RtcReason,
    tax_regime: TaxRegime,
    issue_date: date | None,
    cfop: str | None,
) -> tuple[Conformity, ConformityReason]:
    """Avalia conformidade a partir do reason (F0.7a) + regime + data + CFOP."""
```

Tabela de decisão (precedência EXATA — DATA PRIMEIRO):

| Precedência | Condição | Resultado |
|---|---|---|
| **1** | `issue_date is None` | `(NAO_AVALIADO, DATA_AUSENTE)` |
| **2** | `issue_date < 2026-01-01` | `(NAO_AVALIADO, PRE_2026)` |
| **3** | `reason == UNKNOWN_DIRECTION` | `(NAO_AVALIADO, DIRECAO_DESCONHECIDA)` |
| **4a** | `reason == EXCLUDED_CFOP` e CFOP normalizado (4 dígitos) começa com "7" e NÃO "79" | `(CONFORME, EXPORTACAO_IMUNE)` |
| **4b** | `reason == EXCLUDED_CFOP` e demais casos | `(NAO_AVALIADO, NAO_COMERCIAL)` |
| **5** | `reason in {INBOUND, OUTBOUND}` | `(CONFORME, DESTAQUE_PRESENTE)` |
| **6a** | `reason == NO_HIGHLIGHT` e `tax_regime == SIMPLES_NACIONAL` | `(CONFORME, REGIME_SIMPLES)` |
| **6b** | `reason == NO_HIGHLIGHT` e `tax_regime == RPA` | `(INCONFORMIDADE, RPA_SEM_DESTAQUE)` |
| **6c** | `reason == NO_HIGHLIGHT` e `tax_regime == SIMPLES_EXCESSO` | `(INCONFORMIDADE, SIMPLES_EXCESSO_SEM_DESTAQUE)` |
| **6d** | `reason == NO_HIGHLIGHT` e `tax_regime == MEI` | `(NAO_AVALIADO, REGIME_MEI)` |
| **6e** | `reason == NO_HIGHLIGHT` e `tax_regime == UNKNOWN` | `(NAO_AVALIADO, REGIME_DESCONHECIDO)` |

**Observações:**

- **Precedência por DATA primeiro:** Documentos sem data ou pré-2026 são NAO_AVALIADO
  independentemente de regime ou destaque — RTC só vigora a partir de 2026 (LC 214/2025).

- **Exportação 7.xxx e não-79xx:** Normaliza CFOP (4 dígitos), testa se começa com "7"
  e NÃO com "79" — exportação imune é 7.1xx a 7.8xx; 7.9xx (outras operações) não-comercial.

- **Sem whitelist adicional de CFOP:** Apenas consumimos reason (RtcReason) de F0.7a
  — a classificação já honra R2 (EXCLUDED_CFOP) e R4 (NO_HIGHLIGHT). A tabela
  inspeciona CFOP apenas para separar **export 7.1xx–7.8xx** (imunidade) de 7.9xx/59xx/69xx
  (não-comercial).

- **RPA sem destaque = INCONFORMIDADE:** Se reason=NO_HIGHLIGHT e regime=RPA (saída
  comercial sem destaque), é INCONFORMIDADE — RPA **obriga destaque em operação comercial**.

- **SIMPLES_EXCESSO:** Simples Nacional que ultrapassou o sublimite de receita; como RPA,
  obriga destaque em operação comercial — ausência é INCONFORMIDADE.

- **MEI conservador (NAO_AVALIADO):** Até SME fiscal confirmar se MEI é obrigado a descontar
  IBS/CBS (como RPA) ou é regime de não-incidência (como Simples Nacional), marcamos como
  NAO_AVALIADO. Sem decisão, não sinaliza INCONFORMIDADE falsa.

### 4. Fonte única: RtcReason de F0.7a

A tabela acima **não reinventa whitelist de CFOP** — confia no resultado de F0.7a:

- Já classificou por `direction` e `reason` (CREDIT/DEBIT/NEUTRAL).
- F0.7a validou CFOP excluso (R2) e sem destaque (R4).
- F0.7b **consome reason** e aplica lógica de regime.

Quando **inspecionamos CFOP 7.xxx**, é apenas para marcar **imunidade com crédito
mantido** (opção de conformidade). Não reaplicamos validação de CFOP.

### 5. Mapeamento CRT → TaxRegime

NF-e não carrega `opSimpNac` (operação Simples Nacional). Contrato do parser F1.5
lê o campo `CRT` (Código de Regime Tributário, valores 1–4) e mapeia:

```python
CRT_MAP = {
    1: TaxRegime.SIMPLES_NACIONAL,  # Simples Nacional (dentro do sublimite)
    2: TaxRegime.SIMPLES_EXCESSO,   # Simples Nacional em Excesso (acima do sublimite)
    3: TaxRegime.RPA,                # RPA (Regime Periódico de Apuração)
    4: TaxRegime.MEI,                # MEI (Microempreendedor Individual)
}
```

**Nota:** Se o campo CRT não existir, `TaxRegime.UNKNOWN`.

### 6. Apuração: Item-level (padrão) e Doc-level (CT-e)

- **Padrão (NFe, NFS-e):** Apura por item. Cada item gera impacto (CREDIT/DEBIT/NEUTRAL),
  conformidade e contribui ao saldo.

- **CT-e (Conhecimento de Transporte):** Se `fiscal_document.items == ()` (documento
  sem itens detalhe — pode conter taxa de frete agregada no cabeçalho), apura em
  **nível de documento**. Preserva crédito de frete (não segrega por item).

Função (keyword-only):

```python
def apurar(
    documents: Iterable[FiscalDocument],
    *,
    period_start: date | None,
    period_end: date | None,
    granularity: Granularity,
) -> Apuracao:
    """
    Apura creditos/debitos/saldo de IBS/CBS de um conjunto de documentos.
    Para cada documento: classifica impacto (F0.7a), conformidade (F0.7b),
    acumula créditos/débitos por tributo separadamente, computa índices.

    Sem deduplicação nem validação de janela (caller responsável).
    period_start/period_end/granularity são metadados do resultado.
    """
```

### 7. Engine Puro

- **Sem IO:** Não lê nem escreve arquivos/BD.
- **Sem FastAPI/ORM:** Dataclasses frozen + slots.
- **Sem Pydantic direto:** (Conversão vira responsabilidade da camada de
  repositório do backend.)
- **Decimal sempre:** Operações monetárias em `Decimal` com `ROUND_HALF_UP`.
- **Sem PII direta:** `access_key` trata-se apenas como referência indireta em
  `InconformidadeRef` (se necessário em F1.0+ para auditoria), e é comentada como
  dado sensível. Fixtures usam `synthetic_access_key()` (generator de chaves
  fictícias).

### 8. Conformidade Agnóstica à Aplicação

Engine computa conformidade (`Conformity`, `ConformityReason`) mas não persiste
nem marca auditorias. Responsabilidade do repositório/aplicação (F1.0+):

- Guardar `conformity` e `conformity_reason` em `fiscal_document_items`.
- Gerar lista de inconformidades (tabela-filha ou JSONB) para relatório.
- Registrar em `audit_logs` quem marcou/corrigiu conformidade (trilha de auditoria).

## Alternativas consideradas

- **Opção A — Saldo somado (rejeitada).** Agregar IBS+CBS na figura principal de
  liquidação. Problema: Caso 3 da spec comprova que um déficit em um tributo pode
  ficar oculto. Separação honra requisito de precisão fiscal.

- **Opção B — Whitelist própria de CFOP na conformidade (rejeitada).** Reler CFOP
  em F0.7b para marcar conformidade. Problema: falso-negativo (CFOP 5656/5202 de
  remessa entra, sem whitelist em F0.7a já o exclui, mas se F0.7b tiver sua própria
  whitelist pode não sinalizá-lo). Fonte única (F0.7a RtcReason) reduz duplicação.

- **Opção C — Base gross_value em vez de v_bc (diferida a SME).** Proposta inicial
  usava gross_value. Escolhido v_bc (§2.3 da spec) após análise. Diferir ajuste de
  base a F3.6 (TaxRateProvider) se necessário.

- **Opção D — Iterar apenas itens, ignorar frete de CT-e (rejeitada).** CT-e pode
  ter taxa de frete agregada no documento. Perde crédito de transporte se não
  apurar nível de documento. Implementado doc-level para CT-e.

- **Opção E — MEI = CONFORME (rejeitada).** Sem clareza de SME, conservador:
  NAO_AVALIADO. Quando SME confirmar (igual SN ou diferente), ajusta tabela.

- **Opção F — CRT=2 & opSimpNac=3 = MEI (rejeitada).** Campo `opSimpNac` não existe
  em NF-e. CRT=2 já implica Simples em Excesso (contrato F1.5/SME). Mapeamento direto.

- **Opção G — TaxRateProvider agora (rejeitada por YAGNI).** Conceitual: um
  provider injeta alíquotas por regime em conformidade (ex.: alíquota diferente
  de Simples Excesso vs. RPA). Diferir a F3.6 quando houver caso de uso real.

## Consequências

**Positivas:**

- **Separação IBS/CBS evita erro de liquidação:** Modelo fiel à lei (não-cumulatividade
  distinta). Agregados existem apenas para exibição/insumo de índice.
- **Índice determinístico com None honesto:** Divisão por zero não arredonda
  falsamente; sinal do saldo é preservado.
- **Conformidade coerente:** Mesmo predicado "comercial" (reason de F0.7a) governa
  índice e conformidade — sem duplicação lógica.
- **Engine puro, sem PII direta, impacto regime-agnóstico:** Reutilizável em
  múltiplos contextos (auditoria, simulação, multi-tenant). ADR 0009 (impacto)
  intacto — F0.7b estende, não refaz.
- **CT-e contabilizado:** Preserva crédito de frete mesmo sem itens detalhe.
- **Tabela de conformidade clara:** Precedência documentada facilita evolução
  (SME pode ajustar ordem ou critérios sem ambiguidade).

**Negativos / Pendências:**

- **Gaps de data-model:** Migração de BD necessária (apuracoes += colunas de
  saldo/índice split IBS/CBS; fiscal_document_items += conformity/conformity_reason;
  estrutura de lista de inconformidades). Diferida ao engenheiro-dados (fatia
  futura). Engine entrega tipos, repositório monta tabelas.

- **Várias escolhas dependem de validação SME:**
  - Base: v_bc vs. gross_value? (Escolhido v_bc §2.3; diferir ajuste a F3.6.)
  - Sinal vs. |Saldo| em índice? (Escolhido sinal; validar expectativa fiscal.)
  - MEI: regime distinto de SN ou igual? (Escolhido conservador NAO_AVALIADO.)
  - CRT=2: realmente SIMPLES_EXCESSO, ou ler outro campo?
  - UNKNOWN regime: como reportar (continua NAO_AVALIADO ou tenta inferir)?
  - Transferências 5.15x/6.15x: quando regulamentado, como marcar conformidade?
  - Export 7.1xx (sub-ítem 7.1) CONFORME vs. 7.9xx NAO_AVALIADO?: Validar split
    de sub-CFOP.
  - Destaque indevido em imune (ex.: 7.1xx com destaque, mas operação é imune):
    marcar INCONFORMIDADE? (Seam com F3.6 TaxRateProvider — regra DESTAQUE_DIVERGENTE.)
  - Arredondamento: HALF_UP confirmado para todos os contextos?
  - Confirmação da separação IBS/CBS em LC 214/2025?

- **Dedup e seleção de período:** Não é responsabilidade de `apurar()` — caller
  (repositório ou serviço de aplicação) cuida. Engine confia no conjunto recebido
  (se mesmo `access_key` aparece 2x, soma-se 2x).

- **TaxRateProvider documentado mas diferido:** F3.6 introduzirá verificação de
  alíquotas por regime para detectar **destaque_divergente** (ex.: destaque de
  IBS quando regime não obriga). Seam já documentado em consequências — não entra
  em F0.7b.

## Decisões pendentes de SME fiscal

- **Base: v_bc vs. gross_value?** Adotado v_bc (§2.3). Validar com SME se cabe
  ajuste em F3.6 (TaxRateProvider).

- **Sinal do índice de saldo:** Adotado com sinal (positivo = crédito, negativo
  = déficit). Validar expectativa fiscal em relatório.

- **MEI regime:** Obrigado a descontar IBS/CBS como RPA? Ou Simples Nacional?
  Hoje conservador (NAO_AVALIADO). Ajusta tabela quando confirmado.

- **CRT=2 e SIMPLES_EXCESSO:** Realmente mapeamento direto, ou há outro campo
  (opSimpNac)? Validar com parser F1.5/contrato SME.

- **UNKNOWN regime:** Continua NAO_AVALIADO em conformidade. Há regra de inferência
  (ex.: por UF ou setor) ou sempre standby?

- **Transferências 5.15x/6.15x após regulamentação:** Quando Receita autorizar,
  como marcar conformidade (CONFORME se manutenção de crédito, ou sub-tipo)?

- **Export 7.1xx sub-item vs. 7.9xx:** Há diferença de conformidade (7.1 é
  operação econômica em exterior; 7.9 é operação intermediária)? Validar split
  de CFOP 7.xxx.

- **Destaque indevido em imune:** RPA exporta CFOP 7.1xx COM destaque (desnecessário
  — operação já é imune). Marcar como INCONFORMIDADE de destaque divergente?
  Seam com TaxRateProvider (F3.6).

- **Arredondamento HALF_UP:** Bancário, padrão fiscal? Confirmação.

- **LC 214/2025 § — separação IBS/CBS:** Confirmação de que não-cumulatividade
  é distinta e requer saldo separado.

---

## Versionamento

- **Versão:** 1.0 (F0.7b final)
- **Data:** 2026-06-30
- **Decisão arquitetural:** 0009 (impacto), 0010 (apuração e conformidade)
- **Implementação:** `/workspace/backend/fiscal_engine/apuracao.py`,
  `/workspace/backend/fiscal_engine/conformity.py`, enums em
  `/workspace/backend/fiscal_engine/enums.py`, modelos em
  `/workspace/backend/fiscal_engine/models.py`.
- **Testes:** `/workspace/backend/tests/fiscal_engine/test_apuracao.py`,
  `/workspace/backend/tests/fiscal_engine/test_conformity.py`,
  `/workspace/backend/tests/fiscal_engine/test_domain.py` (cobertura 100%).

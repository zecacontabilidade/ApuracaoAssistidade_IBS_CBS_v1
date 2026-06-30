# Catálogo vivo de regras de negócio fiscais — F0.7a+

**Propósito:** Registro dinâmico das regras de negócio que definem a classificação
de crédito, débito e neutro em IBS/CBS, além de apuração e conformidade. Este é o documento **revisável por humanos**
e **validável por SME fiscal** — a fonte única de verdade técnica (as decisões
arquiteturais correspondentes vivem em ADR 0009 [impacto] e ADR 0010 [apuração + conformidade]).

Diferente de um ADR (que registra *decisão* tomada), este catálogo registra
**as regras em vigor** tal qual implementadas no código. Toda mudança de regra
exige (i) atualizar a tabela, (ii) validação de SME, (iii) código/testes, (iv)
ADR adicional se for decisão.

**Aviso de validade:** Este catálogo é corrente para o motor F0.7a (impacto) e F0.7b (apuração + conformidade).
Futuras fatias (F1.0/F1.5+) podem adicionar regras de taxa, repositório, e endpoints — não eliminam estas.

---

## Tabela: regras de determinação de impacto RTC (F0.7a)

| Regra | Enunciado | Fundamento | Status |
|-------|-----------|-----------|--------|
| **R1: Precedência de direção desconhecida** | Se `direction == UNKNOWN`, o resultado é `(impact: NEUTRAL, reason: UNKNOWN_DIRECTION)` independentemente de CFOP ou destaque. | SPEC_XML_MAPPING_v2.md (prosa v2:46–49); contrato F0.7a. Ocorre quando parser F1.5 não consegue determinar sentido econômico de entrada auto-emitida (falta `tpNF`; `purpose` já existe como DocumentPurpose). | TRAVADA |
| **R2: Filtro de CFOP excluído** | Se CFOP (após normalização: remover não-dígitos, exigir exatamente 4 dígitos) começa com prefixo em `CFOP_EXCLUDED_PREFIXES = {"7", "59", "69", "515", "615"}`, resultado é `(NEUTRAL, EXCLUDED_CFOP)`. | `"7"`: exportação imune (LC 214/2025 / EC 132 — RTC). `"59"`, `"69"`: remessas, brindes, amostras, consignação, industrialização (não geram destaque obrigatório). `"515"`, `"615"`: transferências entre estabelecimentos próprios (decisão do humano: excluir até regulamentação). | TRAVADA |
| **R3: Guarda robusta de comprimento CFOP** | CFOP com comprimento ≠ 4 dígitos após normalização (ex.: NBS de 9 dígitos da NFS-e) retorna `False` (não excluído) e segue para regras subsequentes. Blinda contra confusão de códigos tributários. | SPEC_XML_MAPPING_v2.md — mapeamento NFS-e: `cTribNac` (9 dígitos, NBS) às vezes rotulado como `item.cfop`. Robustez de parser. | TRAVADA |
| **R4: Precedência de destaque zero** | Se `v_ibs + v_cbs == 0` (ambos Decimal, não float), resultado é `(NEUTRAL, NO_HIGHLIGHT)` independentemente de direction (exceto se já cobertas por R1 ou R2). | SPEC_XML_MAPPING_v2.md (prosa v2:46–49 — zero-check explícito, não o pseudocódigo `enrichItem`). SPEC_BUSINESS_RULES.md §3.4 — fornecedor Simples Nacional não destaca IBS/CBS, resultado é NEUTRAL (regime esperado, não inconformidade do fornecedor). | TRAVADA |
| **R5: Entrada com destaque → Crédito** | Se `direction == INBOUND` e `v_ibs + v_cbs > 0`, resultado é `(CREDIT, INBOUND)`. | LC 214/2025 / EC 132 (RTC) — entrada comercial com destaque gera crédito de IBS/CBS. SPEC_XML_MAPPING_v2.md — direção é driver principal. | TRAVADA |
| **R6: Saída com destaque → Débito** | Se `direction == OUTBOUND` e `v_ibs + v_cbs > 0`, resultado é `(DEBIT, OUTBOUND)`. | LC 214/2025 / EC 132 (RTC) — saída comercial com destaque gera débito de IBS/CBS. | TRAVADA |
| **R7: Direction = sentido ECONÔMICO** | Direction (INBOUND/OUTBOUND/UNKNOWN) é **sempre** calculada pelo parser F1.5 a partir de `tpNF` (tipo de nota) + `finNFe` (finalidade) + posição do CNPJ-raiz no documento, NUNCA pela posição bruta emitente/destinatário. | SPEC_XML_MAPPING_v2.md; necessário para desambiguar entrada auto-emitida (devolução 1.2xx, importação 3.1xx) e evitar dupla-inversão em devolução. Separação de responsabilidades: engine consome direction pronta. | TRAVADA (implementação no parser F1.5) |
| **R8: Devolução não inverte sinal** | Nota de devolução é tratada por direction + destaque **do próprio documento**, sem inverter sinal. A direção da nota de devolução é calculada conforme a posição do emitente no documento: cliente que devolveu mercadoria emite nota 1.2xx/6.2xx e é OUTBOUND (saída de mercadoria). Se houver destaque, gera DEBIT. Não há inversão de sinal dentro do engine. | SPEC_XML_MAPPING_v2.md — direction já incorpora a semântica de devolução; CFOP 1.2xx/6.2xx é apenas classe de documento, não diretor de inversão. LC 214/2025 comenta que devolução de compra (nota emitida por vendedor) é saída = débito. | TRAVADA (validação SME pendente — ver abaixo) |
| **R9: Fornecedor Simples Nacional → NEUTRAL** | Entrada de fornecedor em regime Simples Nacional tipicamente não destaca IBS/CBS (v_ibs=0, v_cbs=0). Cai automaticamente em R4 (NO_HIGHLIGHT) → NEUTRAL. Não é inconformidade do fornecedor, é regra do regime. | SPEC_BUSINESS_RULES.md §3.4; implementação via R4 (não há campo `tax_regime` na regra de impacto, pois não-necessário). F0.7b pode usar `TaxRegime` como metadado para relatório. | TRAVADA |
| **R10: Sem destaque ≠ INCONFORMIDADE em F0.7a** | Engine classifica como `NEUTRAL/NO_HIGHLIGHT` e **não marca como INCONFORMIDADE**. Quem decide se é inconformidade (ex.: saída comercial de RPA sem destaque) é F0.7b, via `RtcReason` + outras regras de conformidade. F0.7a é puro impacto. | Separação de responsabilidades; engine não tem conhecimento de conformidade (que depende de regime, modelo de negócio, e regras de auditoria). | TRAVADA |
| **R11: Exportação (7.xxx) → NEUTRAL** | Exportação (CFOP 7.xxx) gera `NEUTRAL/EXCLUDED_CFOP` (via R2). É operação imune — não gera débito. Crédito é mantido (manutenção de crédito de exportação). | LC 214/2025 / EC 132 — exportações são imunes à RTC, com manutenção de crédito. `CFOP_EXCLUDED_PREFIXES` inclui `"7"`. | TRAVADA (validação SME para "manutenção de crédito em F0.7b" pendente — ver abaixo) |
| **R12: Transferências 5.15x/6.15x → NEUTRAL (por ora)** | Transferências entre estabelecimentos próprios (5.15x intra-estadual, 6.15x interestadual) geram `NEUTRAL/EXCLUDED_CFOP` até regulamentação sair. | Decisão do humano (F0.7a não tem SME fiscal permanente). Quando regulamentação autorizar, remover `"515"` e `"615"` de `CFOP_EXCLUDED_PREFIXES` e a regra trata como INBOUND/OUTBOUND conforme direção. | PENDENTE-SME (quando regularizar? como?) |
| **R13: Valores sempre Decimal** | Toda moeda (`v_ibs`, `v_cbs`, `gross_value` em `FiscalItem`/`FiscalDocument`) é `Decimal`, nunca `float`. Operações matemáticas (`v_ibs + v_cbs`, comparação com `0`) usam `Decimal` puro. | Preservação de centavos sem erro de ponto flutuante (requisito universal de sistema fiscal). Legado do frontend usava `float` — corrigido em F0.7a. | TRAVADA |
| **R14: Validação de valores não-negativos** | `classify_rtc_impact` valida pré-condição: `v_ibs >= 0` e `v_cbs >= 0`. Levanta `ValueError` se violar. | Valores destacados não podem ser negativos; se parser envia negativo, é bug grave. Cria ponto de bloqueio visível. | TRAVADA |

---

## F0.7b — Apuração e Conformidade

| Regra | Enunciado | Fundamento | Status |
|-------|-----------|-----------|--------|
| **R15: Saldo IBS e CBS separados** | Creditos, débitos e saldo de IBS e CBS são mantidos **separados**, sem agregação na figura principal. Agregado (Σ IBS + Σ CBS) existe apenas como derivado de exibição e insumo de cálculo de índice, NUNCA como figura de liquidação. | SPEC_BUSINESS_RULES §6; LC 214/2025 (não-cumulatividade distinta por tributo). Caso 3 da especificação: saldo agregado erroneamente positivo mascara déficit em tributo específico. | TRAVADA |
| **R16: Índices com base v_bc e divisão-zero → None** | Índices (idx_credito_entradas, idx_debito_saidas, idx_saldo_saidas) calculados como (numerador / base_entradas|saidas) × 100, onde base = Σ v_bc por direção. Se base == 0, índice retorna None (não 0.00). Arredondamento HALF_UP 0.01. Variantes _ibs/_cbs mantêm tributo. Sinal preservado em idx_saldo (positivo = crédito, negativo = déficit). | SPEC_BUSINESS_RULES §6.2; precisão fiscal Decimal (nunca float). Divisão-por-zero honra desconhecimento vs. falsear arredondamento. | TRAVADA (base v_bc PENDENTE-SME: confirmar vs. gross_value; sinal PENDENTE-SME) |
| **R17: Tabela de conformidade com precedência fixa (DATA PRIMEIRO)** | Conformidade é função de (issue_date, reason, tax_regime, cfop) com tabela de decisão de precedência (EXATA): (1) issue_date ausente → NAO_AVALIADO/DATA_AUSENTE; (2) issue_date < 2026-01-01 → NAO_AVALIADO/PRE_2026; (3) reason UNKNOWN_DIRECTION → NAO_AVALIADO/DIRECAO_DESCONHECIDA; (4a) reason EXCLUDED_CFOP + CFOP 7.1–7.8 (4 dígitos, começa "7" não "79") → CONFORME/EXPORTACAO_IMUNE; (4b) reason EXCLUDED_CFOP demais → NAO_AVALIADO/NAO_COMERCIAL; (5) reason INBOUND/OUTBOUND → CONFORME/DESTAQUE_PRESENTE; (6) reason NO_HIGHLIGHT por regime: SIMPLES_NACIONAL → CONFORME/REGIME_SIMPLES; RPA → INCONFORMIDADE/RPA_SEM_DESTAQUE; SIMPLES_EXCESSO → INCONFORMIDADE/SIMPLES_EXCESSO_SEM_DESTAQUE; MEI → NAO_AVALIADO/REGIME_MEI; UNKNOWN → NAO_AVALIADO/REGIME_DESCONHECIDO. | SPEC_BUSINESS_RULES §5; LC 214/2025 (regra de regime e vigência a partir de 2026). Sem whitelist adicional de CFOP — consome reason puro de F0.7a (ADR 0009). Inspeção de CFOP 7.xxx apenas para separar exportação imune de não-comercial. MEI conservador (NAO_AVALIADO) até confirmação SME. | TRAVADA (tabela completa em ADR 0010 §3) |
| **R18: Fonte única "comercial" = RtcReason** | Conformidade não reinventa whitelist de CFOP — confia no resultado de F0.7a (classify_rtc_impact). RtcReason já validou CFOP excluído (R2) e sem destaque (R4). F0.7b interpreta e aplica lógica de regime. | Separação de responsabilidades; evita duplicação lógica. F0.7a é puro impacto; F0.7b é conformidade. | TRAVADA |
| **R19: Mapeamento CRT → TaxRegime** | Parser F1.5 lê campo CRT (Código de Regime Tributário) de NF-e e mapeia direto: CRT 1 → SN, CRT 2 → SIMPLES_EXCESSO, CRT 3 → RPA, CRT 4 → MEI. Se campo ausente → UNKNOWN. NF-e não carrega opSimpNac (operação Simples Nacional); contrato com SME autoriza mapeamento direto de CRT=2 → SIMPLES_EXCESSO. | Contrato F1.5/SME. NF-e OM (Manual de Orientação da Nota Fiscal Eletrônica). | PENDENTE-SME (CRT=2 realmente SIMPLES_EXCESSO? há outro campo?) |
| **R20: MEI conservador = NAO_AVALIADO** | Microempreendedor Individual (MEI, TaxRegime.MEI) é marcado em conformidade como NAO_AVALIADO/REGIME_MEI até SME fiscal confirmar se é obrigado a descontar IBS/CBS (como RPA) ou se é regime de não-incidência (como Simples Nacional). Se confirmado = Simples Nacional, regra muda para CONFORME/REGIME_SIMPLES. | Precaução: MEI é regime novo na RTC. Sem atualização de lei ou circulares, standby conservador. | PENDENTE-SME (MEI é RPA-like ou SN-like?) |
| **R21: UNKNOWN regime = NAO_AVALIADO** | Se regime de um documento é UNKNOWN (parser não conseguiu mapear CRT, ou campo ausente), conformidade retorna NAO_AVALIADO. Não tenta inferência (ex.: por UF ou setor). | Fail-closed: sem informação, suspende avaliação. | TRAVADA |
| **R22: Apuração por item (padrão) vs. doc-level (CT-e)** | Padrão: apura por item, agregando creditos/debitos de cada um. CT-e (Conhecimento de Transporte): se `fiscal_document.items == ()` (sem itens detalhe), apura em nível de documento (usa v_ibs/v_cbs/v_bc do cabeçalho). Preserva crédito de frete. | CT-e Sefaz: pode ter taxa agregada no cabeçalho, sem itens detalhe. Sem apuração doc-level, perde frete. | TRAVADA |
| **R23: Apuração = função pura, sem dedup/seleção de período** | Função `apurar(items: list[FiscalItem], document: FiscalDocument, tax_regime: TaxRegime) → Apuracao` toma lista como-é (sem filtrar duplicatas, sem validar janela de período). Caller (repositório ou serviço) responsável por dedup e seleção. Engine confia no conjunto. | Separação: engine não conhece lógica de aplicação (dedup, período). Repositório valida antes de chamar. | TRAVADA |
| **R24: Engine puro — sem IO, ORM, Pydantic direto** | Apuração e conformidade vivem em `/backend/fiscal_engine/` como dataclasses frozen+slots, Decimal sempre, sem FastAPI/SQLAlchemy. Conversão (domínio ↔ ORM) fica na camada de repositório do backend. | SPEC_BUSINESS_RULES premissa 1 (motor puro). Reutilizável em testes, CLI, multi-tenant. | TRAVADA |

---

## Diferido para F0.7b/F1.0/F1.5

Estas capacidades **não estão em F0.7a** e não são bloqueio; chegam nas fatias
listadas:

### F0.7b: Apuração e conformidade

- **Computar saldo acumulado:** somar `v_ibs` e `v_cbs` de múltiplos documentos
  **separadamente** (não-cumulatividade de IBS pode diferir de CBS).
- **Marcar conformidade/INCONFORMIDADE:** usar `RtcReason` + `TaxRegime` + outras
  regras (ex.: se `reason=NO_HIGHLIGHT` mas é saída de RPA, marcar INCONFORMIDADE;
  se CFOP 7.xxx e `reason=EXCLUDED_CFOP`, marcar como imunidade OK).
- **Manutenção de crédito:** registrar crédito mantido em exportação (crédito não
  anulado, só não gera débito).
- **Coluna de conformidade:** adicionar `conformity: Conformity` (enum ou bool) a
  RtcClassification ou documento (novo modelo de dados).
- **Trilha de auditoria:** registrar quem marcou INCONFORMIDADE e por quê (é PII
  de decisão humana, guardada separada do motor).

### F1.0: Scaffold FastAPI + endpoints

- **RPC de classificação:** expor `POST /api/v1/fiscal/classify` que chama
  `classify_rtc_impact` via modelo request Pydantic.
- **Auditoria:** registrar tentativa de cálculo (quem, quando, documento ID).
- **Erro de direção UNKNOWN:** sinalizar ao usuário que dados estão incompletos
  (faltam `tpNF`/`finNFe`/posição de CNPJ).

### F1.5: Parsers XML (NFe, NFS-e, CT-e)

- **Implementar cálculo de Direction:** a partir de `tpNF` (1=NFe, 2=NFS-e, etc.),
  `finNFe` (0=normal, 1=complementar, 2=ajuste, 3=devolução), posição do
  CNPJ-raiz (emit vs. dest). Regra aproximada:
  - Posição = EMIT + finNFe = 0 (normal) → OUTBOUND
  - Posição = DEST + finNFe = 0 (normal) → INBOUND
  - Posição = EMIT + finNFe = 3 (devolução) → INBOUND (devolução de venda = entrada para o vendedor)
  - Posição = DEST + finNFe = 3 (devolução) → OUTBOUND (devolução de compra = saída para o comprador)
  - finNFe = 1 ou 2 → depende do modelo de negócio; pode ser entrada ou saída.
  - (Detalhes em SPEC_XML_MAPPING_v2.md.)

- **Mapear CFOP local para 4-digit:** remover ponto, validar tamanho. Blinda contra
  NBS (9 dígitos) ou outros códigos tributários.

- **Extrair v_ibs e v_cbs:** localizá-los nos blocos de detalhes tributários
  (ex.: `infNFe.det[].imposto.ICMSUndTrib.vICMS` para ICMSUndTrib, ou campo
  equivalente para CBS). Valores em centavos (XML) → converter a Decimal (código).

- **Preencher coluna de `tpNF`** em `FiscalItem`/`FiscalDocument`
  (hoje não existe — gap de data-model). O campo `purpose` (finNFe) já existe
  como enum DocumentPurpose. Necessário para F1.5 calcular direção
  corretamente para entradas auto-emitidas (devolução, importação).

---

## Pendências de validação por SME fiscal

As regras acima estão **TRAVADAS** (implementação concluída, testes verdes). As
questões abaixo requerem **validação de especialista fiscal** ou **decisão do humano**
antes de evoluir para F0.7b/F1.0/F1.5. Cada pergunta deve ter resposta concreta
antes de prosseguir.

### (P1) Devolução sob LC 214/2025

**Pergunta:** Uma nota de devolução de venda (CFOP 1.2xx, emitida pelo cliente que devolveu)
em regime RPA com destaque de IBS/CBS gera crédito ou débito?

- **Cenário:** Cliente A recebeu mercadoria do Fornecedor B. Cliente A não quer
  devolver. Emite nota de devolução 1.2xx para B. Cliente A destaca IBS/CBS na nota.
  Qual é o impacto em Cliente A?

- **Engine responde:** Direction = OUTBOUND (cliente está saindo com mercadoria),
  v_ibs > 0, v_cbs > 0 → impact = DEBIT.

- **Validar:** Is DEBIT a correta interpretação de LC 214/2025 / EC 132? Ou
  devolução é inversão de sinal (crédito → débito, débito → crédito)?

- **Implicação:** Se resposta é "inverte sinal", engine não inverte — direction +
  destaque já previnem, e é F0.7b que refaz o cálculo (via `RtcReason` ou novo
  campo `is_reversal`). Se resposta é "não inverte, DEBIT está certo", implementação
  está OK.

### (P2) Transferências 5.15x/6.15x após regulamentação

**Pergunta:** Quando Receita Federal regulamentar tratamento de transferências
entre estabelecimentos próprios (5.15x intra-estadual, 6.15x interestadual),
devem ser incluídas na base de cálculo ou permanecer neutras?

- **Cenário:** Matriz em São Paulo transfere matéria-prima para filial em Minas.
  Emite 5.151 com vIBS/vCBS. Qual é o impacto?

- **Engine responde:** Hoje, CFOP 5.151 → prefixo "515" → EXCLUDED_CFOP →
  impact = NEUTRAL. Quando regulamentado, remover "515"/"615" de exclusão e
  direction define (matriz → filial = OUTBOUND = DEBIT se houver destaque).

- **Validar:** Qual é a data estimada de regulamentação? É esperada neutralidade
  (não-incidência) ou inclusão na base de cálculo?

- **Implicação:** Ativa mudança em `CFOP_EXCLUDED_PREFIXES` + eventual novo
  modelo de saldo (segregar transferências para relatório).

### (P3) MEI na RTC — regime novo?

**Pergunta:** Microempreendedor Individual (MEI) é regime válido na RTC? Qual é
seu tratamento de destaque (similar a Simples Nacional, ou diferente)?

- **Cenário:** MEI emite NF-e com vIBS/vCBS destacados. Qual é a regra de apuração?

- **Engine responde:** Agnóstico — apenas classifica por direction + destaque.
  `TaxRegime.MEI` pode ser metadado em `FiscalDocument` para relatório, mas não
  afeta a regra de impacto.

- **Validar:** MEI é obrigado a descontar? Se não, v_ibs/v_cbs virão zerados e
  R4 (NO_HIGHLIGHT) cobre. Se sim, tratamento é igual a RPA.

- **Implicação:** Sem código novo em F0.7a; apenas metadado de relatório em F0.7b.

### (P4) FOB/CIF no CT-e — quem paga frete?

**Pergunta:** Conhecimento de Transporte Eletrônico (CT-e) reflete transporte de
mercadoria com incotermos FOB (frete pago pelo comprador) ou CIF (pago pelo
vendedor). Quem arcaria com IBS/CBS do frete — transportador, comprador ou vendedor?

- **Cenário:** Transportador T emite CT-e de frete com incoterm FOB (cliente paga).
  T destaca vIBS/vCBS. Qual é o impacto em T e em Cliente?

- **Engine responde:** Para T (transportador), direction = OUTBOUND (está
  prestando serviço de transporte) → DEBIT se vIBS/vCBS > 0. Para Cliente, não há
  entrada de CT-e no livro (é provedor, não comprador).

- **Validar:** FOB/CIF afeta a base de incidência? Ou é sempre OUTBOUND do
  transportador independentemente?

- **Implicação:** F1.5 deve ler `infCarga.CFOP` ou incoterm para marcar direction
  corretamente no CT-e. Sem mudança de regra em F0.7a.

### (P5) Exportação 7.xxx — conformidade OK ou INCONFORMIDADE-esperada?

**Pergunta:** Exportação gera NEUTRAL/EXCLUDED_CFOP (imune). F0.7b deve marcar
como "conformidade OK" (imunidade legítima) ou "INCONFORMIDADE-esperada"
(esperado não ter débito, mas validar manutenção de crédito)?

- **Cenário:** RPA exporta com CFOP 7.102 e destaca vIBS/vCBS. Engine classifica
  NEUTRAL. F0.7b marca:
  - Opção A: `conformity = OK` (imunidade legal, sem crédito/débito).
  - Opção B: `conformity = EXPECTED_NEUTRAL` (esperado, mas validar manutenção
    de crédito).
  - Opção C: `conformity = INCOME_RECOGNITION_REQUIRED` (crédito mantido deve
    estar documentado em outro lugar).

- **Validar:** Qual é o fluxo de conformidade esperado em auditoria (qual marca
  usar)?

- **Implicação:** Campo de conformidade em F0.7b, sem impacto em regra de impacto
  de F0.7a.

---

## Versionamento

- **Versão:** 2.0 (F0.7a+F0.7b)
- **Data:** 2026-06-30
- **Decisões arquiteturais:** ADR 0009 (Modelo de impacto RTC), ADR 0010 (Apuração e conformidade IBS/CBS)
- **Implementação — F0.7a:** `/workspace/backend/fiscal_engine/impact.py`,
  `/workspace/backend/fiscal_engine/models.py`, `/workspace/backend/fiscal_engine/enums.py`
- **Implementação — F0.7b:** `/workspace/backend/fiscal_engine/apuracao.py`,
  `/workspace/backend/fiscal_engine/conformity.py`
- **Testes:** `/workspace/backend/tests/fiscal_engine/test_domain.py`,
  `/workspace/backend/tests/fiscal_engine/test_impact.py`,
  `/workspace/backend/tests/fiscal_engine/test_apuracao.py`,
  `/workspace/backend/tests/fiscal_engine/test_conformity.py` (cobertura 100%)

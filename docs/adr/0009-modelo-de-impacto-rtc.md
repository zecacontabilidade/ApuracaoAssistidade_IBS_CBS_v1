# ADR 0009 — Modelo de impacto RTC: direção econômica como único driver (SPEC_XML_MAPPING_v2)

- **Status:** Aceito
- **Data:** 2026-06-30
- **Decisores:** arquiteto-lider (com engenheiro-motor-fiscal, revisor-codigo)
- **Relacionados:** 0004 (fiscal_engine como pacote irmão em backend/), 0008
  (layout de pacote e cwd), `docs/data-model.md` (RtcImpact, RtcReason),
  `backend/fiscal_engine/` (implementação), SPEC_XML_MAPPING_v2.md,
  SPEC_BUSINESS_RULES.md, LC 214/2025 / EC 132 (RTC).

## Contexto

A fatia F0.7a (motor fiscal IBS/CBS) deve implementar a classificação de crédito,
débito ou neutro para itens de documentos fiscais eletrônicos, aderindo ao modelo
de negócio do SaaS (reforma tributária RTC — LC 214/2025 / EC 132) e seguindo o
contrato de especificação técnica acumulado (SPEC_XML_MAPPING_v2.md e
SPEC_BUSINESS_RULES.md).

Três questões centrais estavam em aberto:

1. **Qual é o driver principal da classificação:** CFOP (categoria de operação) ou
   direction (sentido econômico INBOUND/OUTBOUND)?
2. **Como tratar operações excluídas** (exportações imunes, remessas, transferências
   entre estabelecimentos)?
3. **Como distinguir NEUTRAL-esperado de candidato a INCONFORMIDADE** sem que o
   engine precise de regras de conformidade (que chegam apenas na F0.7b)?

O estado anterior incluía ambiguidade: SPEC_BUSINESS_RULES.md (legado de F0.2)
usava classes de CFOP (`cfop_category`) para dirigir a classificação, enquanto
SPEC_XML_MAPPING_v2.md (atualização de F0.6/F0.7) propunha que a **direção
econômica** fosse o driver e CFOP tivesse apenas papel de filtro secundário
(excluir operações não-comerciais). Código legado do frontend adotava hardcoding de
alíquotas (17,7% IBS, 8,8% CBS) e lógica por prefixo de CFOP — não portável.

## Decisão

Adotar **SPEC_XML_MAPPING_v2** e implementar a regra de impacto como função pura:

```python
classify_rtc_impact(
    *, direction: Direction, cfop: str | None, v_ibs: Decimal, v_cbs: Decimal
) -> RtcClassification  # (impact: RtcImpact, reason: RtcReason)
```

com precedência EXATA (ordem importa) — a **PROSA** da spec v2 (linhas 46–49),
adotando zero-check **explícito**, não o pseudocódigo `enrichItem` que o omite:

1. **Direção UNKNOWN** → `(NEUTRAL, UNKNOWN_DIRECTION)`
   - O parser (F1.5) não conseguiu determinar se a operação é economicamente
     INBOUND ou OUTBOUND. Trata-se de dados incompletos; o engine trata como
     NEUTRAL até serem corrigidos.

2. **CFOP excluído** → `(NEUTRAL, EXCLUDED_CFOP)`
   - Prefixos de exclusão: `"7"` (exportação imune, LC 214/2025 / EC 132),
     `"59"` e `"69"` (remessas, brindes, amostras, consignação, industrialização),
     `"515"` e `"615"` (transferências entre estabelecimentos próprios — decisão
     do humano: excluir até regulamentação). Normalização robusta: remove
     não-dígitos, exige comprimento exato de 4 dígitos (blinda contra NBS de
     9 dígitos da NFS-e mapeado para `item.cfop`).

3. **Sem destaque de IBS/CBS** → `(NEUTRAL, NO_HIGHLIGHT)`
   - `v_ibs + v_cbs == 0`. Cobre fornecedor Simples Nacional (sem destaque por
     regime) e operações genuinamente isentas. Não é inconformidade do engine —
     quem marca como inconformidade ou esperado é a F0.7b, via `RtcReason`.

4. **INBOUND com destaque** → `(CREDIT, INBOUND)`
   - Entrada econômica gera crédito.

5. **OUTBOUND com destaque** → `(DEBIT, OUTBOUND)`
   - Saída econômica gera débito.

**Separação de responsabilidades:**

- **Engine (F0.7a):** classifica apenas o impacto (CREDIT/DEBIT/NEUTRAL) e o motivo
  (`RtcReason`), **sem recomputar** conformidade. Valores monetários **sempre**
  `Decimal`, nunca `float`. O domínio do engine não carrega campos de identidade
  DIRETOS (sem razão social nem CNPJ avulso de emitente/destinatário). ATENÇÃO:
  'access_key' (chave de acesso de 44 dígitos, preenchida pelo parser F1.5) é um
  identificador INDIRETO — embute o CNPJ do emitente (dígitos 7-20) — e é dado
  comercialmente sensível; deve ser protegido na persistência, transporte e logs
  (RLS, cripto, mascaramento) a partir de F1.5/F1.6. A regra de impacto
  (classify_rtc_impact) não recebe identidade alguma — apenas direction, cfop,
  v_ibs, v_cbs (minimização / LGPD by design). Dataclasses `frozen=True, slots=True`
  — imutabilidade e eficiência.

- **Parser (F1.5):** calcula a `Direction` ECONÔMICA (INBOUND/OUTBOUND/UNKNOWN)
  a partir de `tpNF` (tipo de nota) e `finNFe` (finalidade) combinados com a
  posição do CNPJ-raiz no documento. Isso evita inversão de sinal em entradas
  auto-emitidas (ex.: devolução de venda CFOP 1.2xx, importação CFOP 3.1xx) nas
  quais a posição bruta emitente/destinatário não corresponde ao sentido
  econômico.

- **Conformidade (F0.7b):** interpreta os pares (impact, reason) e aplica regras
  de negócio (ex.: marcar como INCONFORMIDADE se `impact=NEUTRAL` mas
  `reason=NO_HIGHLIGHT` numa saída comercial sem destaque; permitir
  INCONFORMIDADE=false para exportação CFOP 7.xxx mesmo que NEUTRAL, porque é
  imunidade com manutenção de crédito).

## Alternativas consideradas

- **Opção A — cfop_category de SPEC_BUSINESS_RULES (rejeitada).** Classificar por
  faixas de CFOP (ex.: 1.xxx/2.xxx = entrada, 5.xxx/6.xxx = saída) sem depender
  de direction calculada. Problemas: (i) spec foi superada por SPEC_XML_MAPPING_v2
  após feedback de F0.6; (ii) inversão por categoria arrisca **dupla inversão** em
  devolução (nota de devolução emitida pelo cliente tem CFOP 1.2xx na posição
  bruta do cliente, mas é saída econômica do cliente — se classificar por CFOP
  1.xxx como entrada, inverte para DEBIT quando deveria ser CREDIT); (iii) exige
  metadado adicional (purpose/finNFe) de todo modo para desambiguar entrada
  auto-emitida, removendo a suposta simplificação.

- **Opção B — portar legado do frontend (rejeitada).** Aliquotas hardcoded (17,7%
  IBS, 8,8% CBS), classificação por prefixo de CFOP, `Math.max(0)` para absorver
  dados malformados, bugs de tipagem. Não é portável, não é testável,
  regime-específico. Engine deve ser puro e regime-agnóstico.

- **Opção C — híbrido com cfop_category como metadado ativo (rejeitada por
  YAGNI).** Manter cfop_category como entrada adicional para quebra de empate em
  casos raros (ex.: intragrupo). Prematura otimização; quando/se surgir a
  necessidade, adiciona-se sem impactar a regra de hoje.

## Consequências

- **Positivas:**
  - Regra **simples, determinística e testável:** precedência clara, sem ramificações
    ocultas. Matriz de 22 casos mapeada em 57 testes unit (cobertura 100%,
    97 statements, 14 branches).
  - **Regime-agnóstica:** não assume aliquotas nem regimes; funciona com RPA,
    Simples Nacional, MEI e futuros.
  - **Engine puro e sem PII:** (LGPD by design — minimização). Identidade do
    contribuinte e contraparte vivem fora, garantindo reusabilidade e
    conformidade com diretrizes de privacidade.
  - **Separação clara:** direção é responsabilidade do parser; conformidade é da
    F0.7b. Engine foca no impacto RTC.

- **Negativos / riscos a registrar (adendo ao ADR 0008):**
  - **(1) Corretude depende de Direction ECONÔMICA:** F1.5 deve calcular a
    direção a partir de `tpNF`/`finNFe` + posição do CNPJ-raiz, não apenas
    emitente/destinatário bruto. **GAP de data-model:** falta coluna `tpNF` em
    `FiscalItem`/`FiscalDocument` para que F1.5 possa inferir direction em
    entradas auto-emitidas (1.2xx = devolução de venda, 3.1xx = importação).
    O campo `purpose` (finNFe) já existe como enum DocumentPurpose. Até tpNF
    existir, falha de inferência de direction degrada para UNKNOWN (→ NEUTRAL)
    com comportamento seguro, alertando o usuário via relatório.
  - **(2) Devolução e transferências:** Devolução é tratada por direction +
    destaque do próprio documento (nada de inversão de sinal). Transferências
    5.15x/6.15x estão excluídas por ora, até análise de SME (foram decisão do
    humano, não de prova de conceito). Quando regulamentação sair, remove-se de
    `CFOP_EXCLUDED_PREFIXES` e a regra trata normalmente como INBOUND/OUTBOUND.
  - **(3) Saldo de IBS e CBS separado em F0.7b:** A fatia F0.7b (apuração) deve
    manter saldo acumulado de `v_ibs` e `v_cbs` **separados** (não-cumulatividade
    distinta para cada um). Engine não faz agregação — apenas classifica item por
    item.
  - **(4) Campo de conformidade em F0.7b:** F0.7b precisa de coluna/campo para
    registrar conformidade (INCONFORMIDADE vs. OK). Engine não computa nem carrega
    PII de auditoria. Não pode marcar exportação 7.xxx como inconformidade
    (imunidade com manutenção de crédito).
  - **(5) Operações intragrupo:** Mesma raiz CNPJ em emit/dest (ex.: matriz emitindo
    para filial) — direction fica ambígua. Requer regra de desempate (ex.: comparar
    CNPJ-raiz completo, ou usar metadata `operationType`). Adiada até surgir caso de
    teste real.

## Decisões pendentes de SME fiscal

A F0.7a entrega o motor puro com 100% de cobertura. As questões abaixo cabem ao
SME (Especialista em Lei Fiscal) e ao humano que valida a especificação antes de
F1.0:

- **Devolução sob LC 214/2025:** Devolução de venda gera crédito ou débito? A nota
  de devolução (CFOP 1.2xx) é emitida pelo cliente (que devolveu) — posição bruta
  emitente é o cliente, mas economicamente é saída do cliente (sai mercadoria).
  Engine classifica por direction (OUTBOUND) + destaque (vIBS/vCBS > 0) →
  DEBIT. Validar se é isso que LC 214/2025 diz.

- **Transferências 5.15x/6.15x:** Hoje excluídas (NEUTRAL). Validar se, após
  regulamentação, devem entrar como INBOUND/OUTBOUND ou permanecer como NEUTRAL.
  Impacta em removê-las de `CFOP_EXCLUDED_PREFIXES` quando autorizado.

- **MEI (Microempreendedor Individual):** Regime novo na RTC? Engine é agnóstico,
  mas `TaxRegime.MEI` pode ser necessário como metadado de relatório.

- **FOB/CIF em CT-e (Conhecimento de Transporte Eletrônico):** Determina quem
  arcaria com IBS/CBS no frete. Impacta direction do frete — cabe ao parser F1.5
  interpretar `infCarga.CFOP` vs. `infQ.infMunDespacho` para marcar direction
  corretamente.

- **Exportação na conformidade (F0.7b):** Exportação 7.xxx gera NEUTRAL (imune).
  Validar se F0.7b deve marcar como INCONFORMIDADE (esperado) ou OK (imune com
  crédito). Hoje engine só diz NEUTRAL/EXCLUDED_CFOP — é F0.7b que interpreta.

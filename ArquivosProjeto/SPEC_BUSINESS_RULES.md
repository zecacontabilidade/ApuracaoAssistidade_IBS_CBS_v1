# SPEC — Regras de Negócio: Apuração IBS/CBS
## Ótica do Declarante — Reforma Tributária do Consumo
> Versão: 1.0 | Data: 2026-06-01
> Base legal: EC 132/2023 | Lei Complementar 214/2025 | NTs SEFAZ/RFB 2024-2025

---

## AVISO SOBRE REGULAMENTAÇÃO EM CURSO

As regras aqui documentadas refletem o entendimento da LC 214/2025 e das Notas Técnicas publicadas até a data deste documento. A regulamentação da Reforma Tributária ainda está em construção (alíquotas definitivas, regimes específicos, etc.). As premissas assumidas devem ser **explicitamente comunicadas na UI** para o usuário.

---

## 1. FUNDAMENTOS DO IBS E DA CBS

### 1.1 Natureza dos Tributos
- **CBS (Contribuição sobre Bens e Serviços)**: tributo federal, substitui PIS e COFINS. Gerido pela RFB.
- **IBS (Imposto sobre Bens e Serviços)**: tributo sub-nacional (estados e municípios), substitui ICMS e ISS. Gerido pelo Comitê Gestor do IBS.
- **Incidência**: qualquer operação com bens ou serviços onerosa, exceto exceções previstas.
- **Princípio**: não-cumulatividade plena. Todo IBS/CBS incidente nas entradas gera crédito contra o débito nas saídas.

### 1.2 Estrutura do IBS
O IBS é composto por:
- IBS Estadual (`pIBSUF` / `vIBSUF`): alíquota definida por cada Estado + DF
- IBS Municipal (`pIBSMun` / `vIBSMun`): alíquota definida por cada Município
- Total IBS = `vIBSUF` + `vIBSMun` (= `vIBS`)

### 1.3 Período de Transição
- **2026**: NF-e e CT-e já devem ter campos IBSCBS, com alíquotas de teste (1% CBS / alíquotas IBS reduzidas)
- **2027-2032**: Convivência gradual. Alíquotas aumentam progressivamente enquanto ICMS/ISS/PIS/COFINS são reduzidos
- **2033**: Extinção completa dos tributos substituídos

**Implicação para a ferramenta**: documentos de 2024 e 2025 não terão campos IBSCBS. Documentos de 2026 em diante devem ter. A ausência de IBSCBS em documentos de 2024/2025 não é inconformidade. A ferramenta deve verificar a data de emissão para determinar se a ausência é esperada ou é inconformidade.

---

## 2. GERAÇÃO DE DÉBITOS DE IBS/CBS

### 2.1 Regra Geral
Todo contribuinte sujeito ao IBS/CBS gera **débito** quando realiza operação **tributada** de saída (venda de mercadoria, prestação de serviço).

### 2.2 Quem Gera Débito

| Situação | Gera Débito? |
|---|---|
| Empresa RPA (Regime Normal) — venda de mercadoria | ✅ Sim |
| Empresa RPA — prestação de serviço | ✅ Sim |
| Empresa do Simples Nacional — saída | ⚠️ Não destaca IBS/CBS separado (alíquota zero no campo, recolhe no DAS) |
| Exportação | ❌ Não (imunidade) |
| Operações isentas | ❌ Não |
| Transferências entre estabelecimentos próprios | ⚠️ Depende de regulamentação |

### 2.3 Base de Cálculo do Débito
- Base = valor da operação (mercadoria + frete + seguro + outras despesas - descontos incondicionais)
- Para NF-e: `gIBSCBS.vBC` por item
- Para CT-e: `gIBSCBS.vBC` no nível do documento

### 2.4 Identificação do Débito na Ferramenta (CFOP + Direção)
Um item gera DÉBITO para a empresa analisada quando:

| Condição | Impacto |
|---|---|
| direction=OUTBOUND + cfop_category=SALE | DÉBITO (venda tributada) |
| direction=OUTBOUND + cfop_category=RETURN | CRÉDITO (recebimento de devolução — estorna débito anterior) |
| direction=INBOUND + cfop_category=RETURN | DÉBITO (devolução de compra — estorna crédito anterior) |

---

## 3. GERAÇÃO DE CRÉDITOS DE IBS/CBS

### 3.1 Princípio da Não-Cumulatividade Plena
Na LC 214/2025, **todo IBS/CBS destacado nas entradas gera crédito**, independentemente de o insumo ser diretamente ligado ao produto final. Isso representa uma evolução significativa em relação ao PIS/COFINS (que tinha listas de insumos elegíveis) e ao ICMS (que exigia "circulação subsequente").

### 3.2 O Que Gera Crédito

| Natureza da Aquisição | Gera Crédito? | Observação |
|---|---|---|
| Compra de mercadoria para revenda (RPA) | ✅ Sim | Crédito integral do IBS/CBS destacado |
| Compra de insumo para produção (RPA) | ✅ Sim | |
| Compra de ativo imobilizado (RPA) | ✅ Sim | Crédito integral ou parcelado — regulamentação pendente |
| Serviços tomados (RPA) | ✅ Sim | CBS destacada na NFS-e (quando padrão for atualizado) |
| Frete de entrada (CT-e) | ✅ Sim | IBS/CBS do CT-e gera crédito para o tomador |
| Compra de fornecedor Simples Nacional | ❌ Não | Fornecedor não destaca IBS/CBS (alíquota zero) |
| Compra isenta ou não tributada | ❌ Não | Sem IBS/CBS destacado |
| Compra para uso/consumo pessoal dos sócios | ❌ Não | Não é insumo da atividade |

### 3.3 Identificação do Crédito na Ferramenta

| Condição | Impacto |
|---|---|
| direction=INBOUND + cfop_category=SALE + vIBS/vCBS > 0 | CRÉDITO |
| direction=INBOUND + document_type=CTE + vIBS/vCBS > 0 | CRÉDITO (frete de entrada) |
| direction=OUTBOUND + cfop_category=RETURN | CRÉDITO (devolução de venda) |

### 3.4 Crédito de Fornecedor Simples Nacional
Esta é uma situação importante que a ferramenta deve tratar:
- Fornecedor Simples Nacional não destaca IBS/CBS nos itens → campo IBSCBS ausente
- Não gera crédito para o adquirente
- Mas deve aparecer como "entrada de fornecedor SN sem crédito" para análise de mix de fornecedores
- Não é uma inconformidade do fornecedor — é a regra do regime

**Regra para a ferramenta**: Para entradas de fornecedor Simples Nacional, `rtc_impact = 'NEUTRAL'` (não gera crédito nem débito) — diferente de fornecedor RPA sem destaque, que é uma inconformidade.

---

## 4. TABELA DE IMPACTOS POR DOCUMENTO E CFOP

### 4.1 NF-e e NFC-e

| Operação | CFOP (exemplos) | Direção | Impacto RTC |
|---|---|---|---|
| Venda de mercadoria | 5.102, 5.405, 6.102 | OUTBOUND | DÉBITO |
| Devolução de compra | 5.201, 6.201 | OUTBOUND | CRÉDITO |
| Transferência de estoque | 5.152, 6.152 | OUTBOUND | NEUTRO |
| Remessa p/ industrialização | 5.901 | OUTBOUND | NEUTRO |
| Compra de mercadoria | (no XML bruto: 5.102, 6.102) | INBOUND | CRÉDITO |
| Devolução de venda | 1.201, 2.201 | INBOUND | DÉBITO |
| Compra de ativo imobilizado | 1.551, 2.551 | INBOUND | CRÉDITO |
| Compra de uso/consumo | 1.556, 2.556 | INBOUND | CRÉDITO |
| Brinde/amostra grátis | 5.910 | OUTBOUND | NEUTRO |
| Exportação | 7.101, 7.102 | OUTBOUND | NEUTRO (imune) |

**Nota crítica**: No XML bruto de uma NF-e de **entrada**, o CFOP gravado é o CFOP de **saída do fornecedor** (ex: 5.102). O sistema ERP do destinatário converte para 1.102. A ferramenta lê o XML bruto, então para documentos INBOUND os CFOPs serão 5.xxx ou 6.xxx — não 1.xxx ou 2.xxx. Isso precisa ser tratado na lógica de categorização.

**Regra ajustada**:
```
Para INBOUND (empresa = destinatário):
  - CFOP 5xxx ou 6xxx com sufixo .1xx ou .4xx → compra (SALE para o fornecedor) → CRÉDITO para nós
  - CFOP 1xxx ou 2xxx com sufixo .2xx → devolução de venda → DÉBITO para nós
  - CFOP 5xxx/6xxx com sufixo .9xx → remessa/outros → NEUTRO

Para OUTBOUND (empresa = emitente):
  - CFOP 5xxx/6xxx com sufixo .1xx ou .4xx → venda → DÉBITO para nós
  - CFOP 5xxx/6xxx com sufixo .2xx → devolução de compra recebida → CRÉDITO para nós
  - CFOP 7xxx → exportação → NEUTRO
```

### 4.2 CT-e

| Operação | Quem paga | Direção | Impacto RTC |
|---|---|---|---|
| Frete de mercadoria comprada (CIF) | Fornecedor paga, mas o custo é do comprador | INBOUND | CRÉDITO para o tomador |
| Frete de mercadoria vendida (FOB) | Comprador paga diretamente | — | Depende do contratante |
| Frete de mercadoria enviada (saída) | Emitente (nós) paga | OUTBOUND (CT-e) | NEUTRO (é custo, não gera débito do frete em si) |

**Simplificação para o MVP**: Para o CT-e, o impacto RTC é determinado pela **direção** do frete em relação à empresa analisada:
- CT-e onde a empresa analisada é o destinatário (receiver) → INBOUND → CRÉDITO (se houver IBS/CBS)
- CT-e onde a empresa analisada é o emitente (transportadora) → OUTBOUND → DÉBITO
- CT-e onde a empresa é o remetente (sender) → operação de saída → DÉBITO vinculado à mercadoria

### 4.3 NFS-e (Padrão ABRASF Atual)

| Operação | Direção | Impacto RTC |
|---|---|---|
| Serviço tomado (empresa = tomador) | INBOUND | NEUTRO (sem IBS/CBS no ABRASF atual) |
| Serviço prestado (empresa = prestador) | OUTBOUND | NEUTRO (sem IBS/CBS no ABRASF atual) |
| *(Futuro, com NFS-e DPS)* Serviço tomado | INBOUND | CRÉDITO CBS |
| *(Futuro, com NFS-e DPS)* Serviço prestado | OUTBOUND | DÉBITO CBS |

---

## 5. REGRAS DE CONFORMIDADE (Relatório)

### 5.1 Definição de Inconformidade
Um documento é **inconfortme** quando ele deveria ter campos IBS/CBS e não os tem.

### 5.2 Critérios de Avaliação

| Critério | Lógica |
|---|---|
| Período de emissão | Se `issue_date < 2026-01-01` → campos IBSCBS não são exigidos → não avaliar conformidade |
| Regime do emitente | Se `tax_regime = SIMPLES_NACIONAL` → sem IBS/CBS é correto → não é inconformidade |
| Natureza da operação | Se operação não é comercial (CFOP de remessa, brinde, etc.) → não avaliar |
| Valores de IBS/CBS | Se `(vIBS || 0) + (vCBS || 0) === 0` E critérios acima não excluem → INCONFORMIDADE |

### 5.3 Classificação de CFOPs Não-Comerciais (Exclusão da Análise)
Operações que **não** geram obrigação de destacar IBS/CBS:

```
Prefixos CFOP a excluir da análise de conformidade:
- 5.9xx / 6.9xx / 7.9xx: outros (brindes, amostras, remessas p/ reparo, bonificações)
- 5.91x / 6.91x: remessas para consignação
- 5.92x / 6.92x: retorno de consignação
- 5.93x / 6.93x: remessa p/ industrialização por conta de terceiros
- 5.94x / 6.94x: retorno de industrialização
- 5.99x / 6.99x: outras saídas não especificadas

CFOPs sempre incluídos na análise:
- 5.1xx / 6.1xx / 7.1xx: compras e vendas de produção própria
- 5.4xx / 6.4xx: saídas com substituição tributária
- 5.5xx / 6.5xx: vendas de ativo imobilizado
- 1.1xx / 2.1xx: entradas de produção (no XML como 5.1xx quando lido do fornecedor)
- 1.5xx / 2.5xx: entradas de ativo (no XML como 5.5xx)
```

### 5.4 Mensagens de Inconformidade (para a UI)

| Tipo | Mensagem sugerida |
|---|---|
| RPA sem IBS/CBS (Entrada) | "Fornecedor em Regime Normal não destacou IBS/CBS. Verificar junto ao fornecedor." |
| RPA sem IBS/CBS (Saída) | "Nota de saída em Regime Normal sem destaque de IBS/CBS. Verificar configuração do sistema." |
| Data anterior a 2026 | "Documento anterior à vigência obrigatória dos campos IBS/CBS." |
| Simples sem destaque | "Fornecedor optante do Simples Nacional — não gera crédito de IBS/CBS." |

---

## 6. CÁLCULO DA APURAÇÃO

### 6.1 Saldo do Período
```
Créditos = Σ (vIBS + vCBS) de todos os itens com rtc_impact = CRÉDITO
Débitos   = Σ (vIBS + vCBS) de todos os itens com rtc_impact = DÉBITO
Saldo     = Créditos - Débitos

Se Saldo > 0: Posição Credora (direito a compensar ou restituir)
Se Saldo < 0: Posição Devedora (obrigação de recolher)
```

### 6.2 Indicadores Derivados (Painel de Apuração)
```
% Carga IBS/CBS s/ Compras  = Créditos / Total_Compras * 100
% Carga IBS/CBS s/ Vendas   = Débitos / Total_Vendas * 100
% Efeito Líquido s/ Vendas  = |Saldo| / Total_Vendas * 100 (com sinal)
```

### 6.3 Agrupamentos para Análise
- Por CFOP: quanto de crédito/débito cada CFOP gerou
- Por CST: distribuição por situação tributária
- Por fornecedor (INBOUND): quem contribuiu com mais crédito
- Por cliente (OUTBOUND): quem gerou mais débito
- Por tipo de documento: NF-e vs CT-e vs NFC-e vs NFS-e

---

## 7. TABELA CST IBS/CBS (Reforma)

A tabela CST para IBS/CBS foi estabelecida nas NTs da reforma. Os principais códigos:

| CST | Descrição | Gera IBS/CBS? |
|---|---|---|
| 001 | Tributada integralmente | ✅ Sim |
| 002 | Tributada com redução de base | ✅ Sim (parcial) |
| 003 | Isenta | ❌ Não |
| 004 | Não incidência | ❌ Não |
| 005 | Imune | ❌ Não (exportação, templos, etc.) |
| 006 | Suspensa | ❌ Não (temporariamente) |
| 007 | Diferimento | ⚠️ Sim (diferido para destinatário) |
| 010 | Tributada com crédito presumido | ✅ Sim (com particularidade) |
| 020 | Regime específico — combustíveis | ✅ Sim (monofásico) |
| 030 | Regime específico — serviços financeiros | ✅ Sim |
| 040 | Regime específico — seguros | ✅ Sim |
| 050 | Tributada pelo regime de caixa | ✅ Sim |
| 060 | Devolvida — crédito | ✅ Crédito |

**Nota**: a tabela completa e oficial de CST será publicada pela RFB. Os códigos acima são baseados nas NTs disponíveis até 2025 e podem ser alterados.

---

## 8. PREMISSAS ASSUMIDAS (PARA COMUNICAÇÃO AO USUÁRIO)

A ferramenta deve deixar claro na UI quais premissas estão sendo assumidas:

1. **Período**: Documentos anteriores a 01/01/2026 não são avaliados quanto à conformidade de IBS/CBS.

2. **Regime do Fornecedor**: A análise de conformidade usa o campo CRT (NF-e/CT-e) ou OptanteSimplesNacional (NFS-e) para determinar se o fornecedor deveria destacar IBS/CBS.

3. **CFOP**: A categorização de CFOPs como comerciais ou não-comerciais usa uma tabela de referência baseada nos prefixos SEFAZ. Operações com CFOPs não mapeados são classificadas como NEUTRAS.

4. **Crédito Integral**: A ferramenta assume crédito integral sobre todo IBS/CBS destacado nas entradas, conforme o princípio da não-cumulatividade plena da LC 214/2025. Regras específicas de proporcionalidade (ex.: uso misto pessoal/profissional) não são verificadas.

5. **NFS-e**: O parser suporta o padrão ABRASF 2.04. NFS-e com padrões municipais proprietários ou a NFS-e federal (DPS) podem não ser reconhecidas corretamente.

6. **CT-e e crédito de frete**: Todo IBS/CBS destacado em CT-e com direção INBOUND é considerado crédito. A regra de CIF/FOB não é verificada automaticamente.

7. **Alíquotas de transição**: Durante 2026-2032, as alíquotas de IBS/CBS nos XMLs são as alíquotas de transição, não as definitivas. A ferramenta usa os valores efetivamente destacados no XML.


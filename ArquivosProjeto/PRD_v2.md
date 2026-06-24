# PRD v2 — Apuração Assistida RTC
## Plataforma de Análise Fiscal Local — Reforma Tributária do Consumo
> Versão: 2.0 | Data: 2026-06-01
> Repositório: CamargoRomuloNegi/RevisaoJulesApuracaoAssistida
> Status: Planejamento MVP

---

## 1. POSICIONAMENTO ESTRATÉGICO

### 1.1 Decisão Arquitetural: Processamento 100% Local (Client-Side)

**Esta é uma decisão deliberada e permanente, não uma limitação.**

Todos os XMLs são processados exclusivamente no navegador do usuário (client-side). Nenhum dado fiscal transita por servidores externos. O produto se enquadra no conceito de **Privacy by Design** (Art. 46 da LGPD), onde a proteção de dados não é um requisito adicionado — é a própria arquitetura.

Justificativas:
- XMLs fiscais contêm dados sensíveis: CNPJs, valores de operação, relações comerciais
- O usuário é o único controlador dos seus dados, sem necessidade de DPA (Data Processing Agreement)
- Elimina custos de infraestrutura de banco de dados, storage e compliance
- Diferencial competitivo frente a ferramentas SaaS que armazenam dados dos clientes
- Modelo de monetização futuro pode ser baseado em licença (não em dados)

**Fluxo de dados garantido:**
```
Disco do usuário → Memória do navegador → Análise → Exportação local → Memória descartada
(Nenhum byte sai do dispositivo do usuário)
```

### 1.2 Versão Atual: MVP de Validação
O objetivo desta fase é validar as hipóteses de produto com usuários reais (contadores, analistas fiscais) antes de qualquer investimento em infraestrutura paga. O MVP deve ser completamente funcional como ferramenta standalone.

### 1.3 Versão Futura (Paga / SaaS)
Quando o produto evoluir para uma versão comercial, a arquitetura local se torna uma **camada de entrada gratuita** (free tier), enquanto a versão paga pode oferecer:
- Persistência opcional (usuário opt-in com consentimento explícito)
- Histórico de apurações por empresa
- Múltiplos diagnósticos simultâneos
- Colaboração (compartilhamento de análises)
- Integração com ERPs via API

---

## 2. ESCOPO DO MVP (Fase 1)

### 2.1 Documentos Fiscais Suportados

| Documento | Modelo | Layout | Status Atual | Status MVP |
|---|---|---|---|---|
| NF-e | 55 | 4.00 | ✅ Implementado | ✅ Manter + corrigir CFOP |
| CT-e | 57 | 3.00a | ✅ Implementado (parcial) | 🔧 Corrigir mapeamento de tributos |
| NFC-e | 65 | 4.00 | ❌ Não implementado | 🎯 Implementar |
| NFS-e | — | ABRASF 2.04 | ❌ Não implementado | 🎯 Implementar |

**Justificativa de escopo:**
- NF-e (55) + NFC-e (65): mesma família XML da SEFAZ, parser similar, cobertura total de operações com mercadorias
- CT-e (57): essencial para empresas que compram/vendem com frete
- NFS-e (ABRASF): representa a maioria dos prestadores de serviço municipais no Brasil (~90% dos municípios)

### 2.2 Funcionalidades do MVP

**Bloco A — Ingestão e Parsing**
- A1: Upload de XML avulso ou ZIP (já funciona) — manter
- A2: Detecção automática de tipo por regex (já funciona) — estender para NFC-e e NFS-e
- A3: Parser NF-e completo e corrigido
- A4: Parser CT-e com mapeamento correto de tributos por componente
- A5: Parser NFC-e (nova implementação, reusa base do NF-e)
- A6: Parser NFS-e ABRASF (nova implementação)
- A7: Log de processamento com categorização de erros por tipo

**Bloco B — Enriquecimento e Análise**
- B1: Detecção automática de CNPJ Raiz (já funciona)
- B2: Classificação de direção INBOUND/OUTBOUND (já funciona)
- B3: Classificação CFOP corrigida (tabela de lookup completa, não regex posicional)
- B4: Impacto RTC por item (CRÉDITO/DÉBITO/NEUTRO)
- B5: Regras de negócio de conformidade por regime tributário

**Bloco C — Visualização**
- C1: Explorador de documentos com filtros (já funciona) — estender para NFC-e/NFS-e
- C2: Modal de detalhes com tributos legados + RTC (já funciona) — estender
- C3: Dashboard de apuração IBS/CBS (KPIs, gráficos por CFOP e CST) — já funciona
- C4: Relatório de conformidade (fornecedores/produtos sem IBS/CBS) — já funciona

**Bloco D — Exportação**
- D1: Excel com 2 abas (cabeçalho + itens analíticos) — já funciona
- D2: CSV por relatório de conformidade — já funciona
- D3: Futuro: PDF de relatório executivo (fora do escopo do MVP inicial)

### 2.3 Fora do Escopo do MVP
- NFS-e Federal/Nacional (DPS — Documento de Prestação de Serviço): padrão novo, ainda em implantação, poucos municípios
- NF3-e (energia elétrica) e CT-e OS (outros serviços): nichos específicos
- Processamento de eventos fiscais (cancelamentos, CCe): complexidade adicional não prioritária
- Validação de assinatura digital (XSD/certificado): aumenta complexidade sem valor imediato para análise tributária
- Autenticação e multi-empresa: irrelevante sem persistência

---

## 3. PERSONAS E CASOS DE USO

### Persona 1: Contador / Analista Fiscal
**Contexto**: Atende empresas de médio porte em regime RPA. Recebe XMLs dos clientes mensalmente. Precisa verificar se os fornecedores estão destacando IBS/CBS corretamente nas notas de entrada.

**Fluxo de uso**:
1. Recebe do cliente um ZIP com todos os XMLs de entrada do mês
2. Faz upload na ferramenta (drag & drop)
3. Identifica o CNPJ da empresa analisada
4. Acessa o Relatório de Conformidade → vê quais fornecedores RPA não destacaram IBS/CBS
5. Exporta Excel analítico para embasar cobranças/negociações com fornecedores
6. Acessa Dashboard RTC → vê o saldo de créditos/débitos apurado

### Persona 2: Gestor Fiscal Interno
**Contexto**: Trabalha em empresa com volume alto de notas (entrada + saída). Precisa apurar mensalmente o saldo de IBS/CBS para declaração.

**Fluxo de uso**:
1. Exporta XMLs do ERP (ou coleta da SEFAZ via download massivo)
2. Faz upload do lote na ferramenta
3. Valida que o CNPJ raiz detectado é o correto
4. Acessa Dashboard RTC → vê créditos, débitos e saldo líquido
5. Detalha por CFOP e CST para conferência com o ERP
6. Exporta Excel para conciliação contábil

---

## 4. INDICADORES DE SUCESSO DO MVP

| Indicador | Meta |
|---|---|
| Processar lote de 500 XMLs em < 30 segundos | Funcional |
| Taxa de parsing com sucesso > 95% para XMLs válidos da SEFAZ | Qualidade |
| Cobertura de 4 tipos de documento | Escopo |
| Usuário consiga apurar saldo IBS/CBS em < 5 minutos após upload | Usabilidade |
| Zero dados transmitidos para servidores externos | LGPD |

---

## 5. RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| NT da SEFAZ mudar estrutura do XML antes do lançamento | Média | Alto | Versionar parsers; abstrair com interface IXmlParser |
| NFS-e municipal ter variações por prefeitura | Alta | Médio | Focar no padrão ABRASF; documentar limitações |
| Usuário tentar carregar XMLs não-fiscais no ZIP | Alta | Baixo | DocumentDetector retorna UNKNOWN + log amigável |
| Performance com ZIPs de 1000+ XMLs | Média | Médio | Processamento assíncrono em lotes; já usa async/await |
| Regras de crédito IBS/CBS ainda em regulamentação | Alta | Alto | Deixar regras configuráveis; documentar premissas assumidas |


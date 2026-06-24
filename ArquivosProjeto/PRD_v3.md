# PRD — Simples Apuração RTC
## Product Requirements Document · Versão 3.0
**Data:** Junho/2026 | **Status:** Beta Funcional | **Responsável:** Rômulo Negi Camargo

---

## 1. Contexto e Origem do Problema

### 1.1 O Problema

A Lei Complementar 214/2025 instituiu a Reforma Tributária do Consumo (RTC), criando o IBS (Imposto sobre Bens e Serviços) e a CBS (Contribuição sobre Bens e Serviços) em substituição gradual ao ICMS, ISS, PIS e COFINS. O período de transição vai de 2026 a 2033.

No cenário tributário de 2026, empresas de todos os regimes tributários (RPA, Simples Nacional, MEI) precisam:

1. **Apurar créditos e débitos** de IBS/CBS embutidos nos documentos fiscais eletrônicos
2. **Identificar inconformidades** — fornecedores RPA que não destacam IBS/CBS corretamente
3. **Avaliar impactos estratégicos** — especialmente empresas do Simples Nacional que precisam decidir se migram para regime híbrido

As ferramentas existentes no mercado (ERP, contabilidade) ainda não processam adequadamente as novas tags XML do IBS/CBS definidas na LC 214/2025.

### 1.2 A Oportunidade

Profissionais de contabilidade e escritórios tributários precisam de uma ferramenta ágil e acessível para:
- Processar lotes de XMLs fiscais e extrair automaticamente os valores de IBS/CBS
- Gerar relatórios de apuração prontos para apresentação a clientes
- Analisar a posição fiscal com inteligência — entendendo o contexto de regime tributário

### 1.3 Proposta de Valor

> **Simples Apuração RTC** é uma ferramenta web de apuração fiscal assistida por IA que processa XMLs fiscais (NF-e, NFC-e, CT-e, NFS-e) localmente no browser, calcula créditos e débitos de IBS/CBS, e gera um dossiê tributário completo com análise adaptada ao regime da empresa — sem enviar dados fiscais a servidores externos.

---

## 2. Princípios Norteadores

| Princípio | Descrição |
|---|---|
| **Privacidade por design** | XMLs processados 100% no browser; nunca enviados a servidores próprios |
| **Zero infraestrutura de dados** | Sem banco de dados fiscal; estado em memória durante a sessão |
| **Acesso controlado** | Autenticação obrigatória; Sign Up desabilitado; usuários criados pelo admin |
| **IA como assistente** | A IA analisa sumários agregados, não documentos individuais |
| **Qualidade sobre velocidade** | Testes automatizados em cada sprint; build limpo obrigatório antes de entrega |

---

## 3. Personas

### P1 — Contador Tributarista
- Atende múltiplos clientes com CNPJs distintos
- Processa lotes de 5.000 a 50.000 XMLs por período
- Precisa de relatórios prontos para apresentação
- Não é desenvolvedor — usa a interface web

### P2 — Controller / Gestor Fiscal Interno
- Responsável pela empresa analisada
- Foca em indicadores de posição credora/devedora
- Quer entender o impacto da RTC nas margens
- Toma decisões sobre regime tributário

### P3 — Auditor Tributário
- Verifica conformidade da carteira de fornecedores
- Identifica riscos de créditos não aproveitados
- Precisa de evidências documentadas (dossiê exportável)

---

## 4. Requisitos Funcionais

### RF-01: Upload e Processamento de XMLs
- **RF-01.1** — Aceitar arquivos `.xml` individuais e `.zip` contendo múltiplos XMLs
- **RF-01.2** — Processar NF-e (v4.0), NFC-e (v4.0), CT-e (v3.0) e NFS-e
- **RF-01.3** — Detectar automaticamente o tipo de documento
- **RF-01.4** — Extrair tags IBS/CBS (`<vIBS>`, `<vCBS>`) por item e por documento
- **RF-01.5** — Classificar documentos como INBOUND (entradas) ou OUTBOUND (saídas)
- **RF-01.6** — Detectar automaticamente o CNPJ raiz da empresa analisada
- **RF-01.7** — Exibir log de processamento com contagem e erros

### RF-02: Apuração RTC
- **RF-02.1** — Calcular total de créditos IBS/CBS (entradas de fornecedores RPA)
- **RF-02.2** — Calcular total de débitos IBS/CBS (saídas da empresa)
- **RF-02.3** — Calcular saldo do período (crédito − débito)
- **RF-02.4** — Calcular índices percentuais: crédito/entradas, débito/saídas, saldo/saídas
- **RF-02.5** — Exibir KPIs financeiros com indicação de posição credora/devedora
- **RF-02.6** — Agrupar resultados por CFOP com crédito e débito individualizados

### RF-03: Análise de Conformidade
- **RF-03.1** — Identificar documentos de emitentes RPA sem IBS/CBS destacado em 2026+
- **RF-03.2** — Classificar por tipo de documento e CFOP
- **RF-03.3** — Exibir lista de inconformidades com detalhes do documento

### RF-04: Análise Temporal
- **RF-04.1** — Agrupar apuração por mês ou trimestre
- **RF-04.2** — Exibir gráfico de crédito, débito e saldo por período (ComposedChart)
- **RF-04.3** — Exibir gráfico de saldo acumulado progressivo (AreaChart)
- **RF-04.4** — Calcular índices percentuais por período (consistentes com RF-02.4)
- **RF-04.5** — Tabela de períodos com todos os indicadores e índices
- **RF-04.6** — Cards de destaque: melhor período, pior período, tendência

### RF-05: Dossiê Tributário (IA)
- **RF-05.1** — Gerar dossiê com um clique ("Gerar Dossiê")
- **RF-05.2** — Dossiê com 9 seções: Sumário Executivo, Posição RTC, Análise de Regime, Conformidade, Por Tipo, Por CFOP, Evolução Temporal, Recomendações, Conclusão
- **RF-05.3** — Análise adaptada ao regime detectado (RPA, Simples Nacional, MEI)
- **RF-05.4** — Análise de perfil B2B/B2C para Simples Nacional
- **RF-05.5** — Indicador de progresso em tempo real com fases e tempo decorrido
- **RF-05.6** — Exportar como HTML autocontido (para e-mail)
- **RF-05.7** — Exportar para PDF via impressão do browser
- **RF-05.8** — Logo e nome da empresa no cabeçalho do relatório exportado

### RF-06: Configurações
- **RF-06.1** — Seleção de modelo Gemini (3.5 Flash, 2.5 Flash, 2.5 Flash-Lite)
- **RF-06.2** — Upload de logotipo da empresa (PNG/JPG/SVG, até 500KB)
- **RF-06.3** — Campo de nome da empresa ("Preparado por")
- **RF-06.4** — Indicador de status da chave de API (GEMINI_API_KEY)
- **RF-06.5** — Aviso permanente de privacidade sobre dados enviados ao Gemini

### RF-07: Autenticação
- **RF-07.1** — Tela de login como rota inicial obrigatória
- **RF-07.2** — Autenticação por email e senha (Supabase Auth)
- **RF-07.3** — Todas as rotas protegidas por middleware
- **RF-07.4** — Sign Up desabilitado — usuários criados pelo administrador
- **RF-07.5** — Exibir email do usuário logado no header
- **RF-07.6** — Botão de logout com encerramento seguro de sessão

---

## 5. Requisitos Não Funcionais

| ID | Requisito | Critério de Aceite |
|---|---|---|
| RNF-01 | Performance de parsing | Processar 1.000 XMLs em < 30s no browser |
| RNF-02 | Privacidade | Zero transmissão de CNPJs ou dados individuais ao exterior |
| RNF-03 | Segurança HTTP | Headers X-Frame-Options, HSTS, Permissions-Policy ativos |
| RNF-04 | Cobertura de testes | ≥ 100 testes automatizados passando em CI |
| RNF-05 | Build limpo | Zero erros TypeScript em `npm run build` |
| RNF-06 | Disponibilidade | Deploy contínuo via Vercel (uptime > 99%) |
| RNF-07 | Fontes locais | Zero dependência de CDN externo em runtime |
| RNF-08 | Chave de API segura | GEMINI_API_KEY nunca exposta ao browser |

---

## 6. Fora do Escopo (versão atual)

- Integração direta com SEFAZ ou portais fiscais
- Multi-tenant com isolamento de dados por empresa
- Histórico persistente de análises entre sessões
- Emissão ou retificação de documentos fiscais
- Cálculo do DIFAL ou outros tributos fora do escopo RTC
- Importação de arquivos SPED

---

## 7. Métricas de Sucesso

| Métrica | Meta |
|---|---|
| Documentos processados por sessão | > 10.000 sem falha |
| Tempo de geração do dossiê | < 3 minutos |
| Precisão dos índices IBS/CBS | 100% (validado por testes) |
| Satisfação do usuário beta | NPS > 50 |


# ROADMAP — Simples Apuração RTC
## Histórico e Planejamento Futuro
**Atualizado:** Junho/2026

---

## SPRINTS CONCLUÍDOS

### Sprint 0–2 ✅ — Fundação
**Objetivo:** criar a base do produto do zero.

**Entregues:**
- Estrutura Next.js 15 + TypeScript com arquitetura em camadas
- 4 parsers completos: NF-e v4.0, NFC-e, CT-e v3.0, NFS-e
- Extração automática das tags `<vIBS>` e `<vCBS>` por item e totais
- Classificação INBOUND/OUTBOUND baseada em CNPJ raiz
- TaxAnalyzerService: calculateApuracao, groupByPeriod, getInconformes
- Interface completa: Upload, Explorador, Apuração, Conformidade
- ExportService: Excel 2 abas (documentos + apuração) + CSV
- Store Zustand com documentos em memória
- 97 testes automatizados passando

**Decisões de arquitetura:**
- Zero backend de dados próprio — tudo client-side
- fast-xml-parser escolhido por segurança XXE (rejeita entidades externas)
- Arquitetura em 4 camadas (Domain → Infrastructure → Application → Presentation)

---

### Sprint 3 ✅ — Análise Temporal
**Objetivo:** adicionar dimensão temporal à apuração.

**Entregues:**
- Rota `/temporal` com toggle Mensal/Trimestral
- ComposedChart: barras de crédito/débito + linha de saldo
- AreaChart: saldo acumulado progressivo com gradiente
- Tabela de períodos com índices % por período
- Cards de destaque: melhor período, pior período, tendência
- Correção de Sidebar (bug de item não inserido no NAV array)
- Correção de índices: saldo ÷ saídas (não ÷ volume total)
- Correção do Tooltip do gráfico de CFOP (labels duplicados)

**Decisão chave:**
- Índice de saldo = saldo ÷ saídas (não ÷ total), pois mede o peso sobre cada R$ vendido

---

### Sprint 4 ✅ — Segurança + IA
**Objetivo:** hardening de segurança e módulo de IA com Gemini.

**Bloco A — Segurança:**
- Vitest atualizado para v4 (resolve CVE esbuild)
- Fontes @fontsource (Outfit + IBM Plex Mono) — zero CDN externo
- HTTP Security Headers no next.config.ts
- Revisão de vulnerabilidades: XXE, XML bomb, XSS, prototype pollution

**Bloco B — Configurações (/settings):**
- Seleção de modelo Gemini (3.5 Flash padrão)
- Upload de logotipo da empresa (base64, localStorage)
- Nome da empresa ("Preparado por")
- Indicador de status GEMINI_API_KEY

**Bloco C — Módulo IA (/ai — Dossiê Tributário):**
- Botão único "Gerar Dossiê" (não chat livre)
- Route Handler /api/ai com streaming SSE (buffer correto)
- Prompt adaptativo por regime: RPA / Simples+B2C / Simples+B2B
- AiContextService: guardião de privacidade — sem CNPJs ou nomes
- Indicador de progresso em tempo real (9 fases, timer, tokens)
- remark-gfm para tabelas Markdown renderizadas corretamente
- Export HTML autocontido + Print/PDF com logo e nome da empresa
- maxOutputTokens: 65536 (sem teto artificial)
- isOriginAllowed: aceita *.vercel.app + localhost
- 118 testes passando (14 novos no AiContextService)

**Correções durante Sprint 4:**
- SSE buffer: split por \n\n (não \n) para chunks TCP parciais
- Prompt reescrito como texto legível (não JSON) → qualidade do dossiê
- isOriginAllowed: VERCEL_URL ≠ URL de produção canônica
- remark-gfm: react-markdown sem plugin não renderiza tabelas

---

### Sprint 6 ✅ — Autenticação (Supabase)
**Objetivo:** restringir acesso à aplicação por login e senha.

**Entregues:**
- @supabase/supabase-js + @supabase/ssr instalados
- src/lib/supabase/client.ts — createBrowserClient
- src/lib/supabase/server.ts — createServerClient com cookies()
- **src/middleware.ts** — protege todas as rotas (deve estar em src/, não na raiz)
- /login — tela profissional, fora do layout principal, com Suspense
- /auth/callback — handler OAuth reservado
- Header com email do usuário e botão de logout
- Sign Up desabilitado — usuários criados pelo admin no Supabase

**Correções críticas durante Sprint 6:**
- **Localização do middleware**: em Next.js 15 com `src/`, deve ser `src/middleware.ts`
  (na raiz, o middleware-manifest.json fica vazio e Vercel mostra 0 invocações)
- **@supabase/ssr incompatível com Edge Runtime**: reescrito sem dependências externas,
  verificação via cookie (name.includes('-auth-token')) — síncrono, fail-safe
- **Logout travado**: router.push() (SPA) trocado por window.location.href
  (navegação HTTP completa) para garantir cookies limpos antes do middleware

---

## BACKLOG — PRÓXIMAS VERSÕES

### Sprint 7 — Qualidade e UX (Recomendado)
**Prioridade:** Alta

- [ ] Content Security Policy (CSP) em modo report-only → enforçar
- [ ] CSRF token no Route Handler /api/ai
- [ ] Migrar xlsx → ExcelJS (eliminar CVE de prototype pollution)
- [ ] Melhorar EmptyStates com orientações mais específicas
- [ ] Toast notifications para ações (upload concluído, exportação, erro)
- [ ] Filtros na tela de Conformidade (por tipo, por CFOP, por fornecedor)
- [ ] Paginação no Explorador de Documentos

### Sprint 8 — Multi-empresa
**Prioridade:** Alta para escritórios de contabilidade

- [ ] Suporte a múltiplos CNPJs na mesma sessão
- [ ] Comparação lado a lado de duas empresas
- [ ] Filtro por CNPJ raiz no lote carregado
- [ ] Histórico de análises em Supabase (tabela pública com RLS)

### Sprint 9 — Relatórios Avançados
**Prioridade:** Média

- [ ] Relatório de fornecedores por regime (tabela completa)
- [ ] Mapa de calor de inconformidades por mês/fornecedor
- [ ] Gráfico de evolução de alíquotas (projeção 2026-2033)
- [ ] Dossiê comparativo período atual vs período anterior
- [ ] Template de e-mail com dossiê inline (não anexo)

### Sprint 10 — Integrações
**Prioridade:** Baixa (depende de validação do produto)

- [ ] Download direto de XMLs do Portal da Nota Fiscal (SEFAZ)
- [ ] Integração com Google Drive / OneDrive para upload
- [ ] Webhook para Slack/Teams com resumo da apuração
- [ ] API pública (read-only) para integração com ERPs

### Versão 2.0 — SaaS Multi-tenant
**Prioridade:** Estratégica (pós-validação beta)

- [ ] Multi-tenant com isolamento por organização
- [ ] Planos (Free / Pro / Enterprise) com limites de documentos
- [ ] Armazenamento opcional de XMLs no Supabase Storage
- [ ] Relatórios agendados (envio automático mensal)
- [ ] Login social (Google, Microsoft)
- [ ] Onboarding guiado para novos usuários

---

## DECISÕES REGISTRADAS (Architecture Decision Records)

| # | Decisão | Alternativa Considerada | Motivo da Escolha |
|---|---|---|---|
| ADR-01 | Processamento client-side | API de parsing no servidor | Privacidade; zero custo de infra |
| ADR-02 | fast-xml-parser | xml2js, DOMParser | Segurança XXE nativa |
| ADR-03 | Zustand | Redux, Jotai, Context | Simplicidade; sem boilerplate |
| ADR-04 | Gemini (não Claude/GPT) | OpenAI, Anthropic | Free Tier generoso; sem cartão |
| ADR-05 | Prompt como texto legível | Contexto como JSON | IA produz output melhor com texto |
| ADR-06 | maxTokens: 65536 (sem teto) | 1024/4096 | Dossiê completo; Free Tier não limita tamanho |
| ADR-07 | window.location.href no logout | router.push() | SPA não limpa cookies antes do middleware |
| ADR-08 | middleware em src/ | raiz do projeto | Next.js 15 com src/ ignora middleware na raiz |
| ADR-09 | Cookie check no middleware | @supabase/ssr no middleware | @supabase/ssr incompatível com Vercel Edge Runtime |
| ADR-10 | xlsx write-only (não migrar) | ExcelJS | CVE não afeta uso de escrita; migração sem benefício |
| ADR-11 | @fontsource | next/font/google, CDN | next/font falha em ambientes sem internet |
| ADR-12 | Supabase Auth | Clerk, Auth.js | Free Tier; controle total; Sign Up desabilitável |


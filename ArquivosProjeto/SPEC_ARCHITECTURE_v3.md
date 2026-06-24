# SPEC — Arquitetura Técnica Completa
## Simples Apuração RTC · Versão 3.0
**Data:** Junho/2026 | **Build:** Sprint 6 homologado

---

## 1. Stack Tecnológica

### 1.1 Frontend / Framework
| Tecnologia | Versão | Papel |
|---|---|---|
| Next.js | 15.5.x | Framework React com App Router, SSR, Route Handlers |
| React | 19.x | UI components |
| TypeScript | 5.x | Type safety em toda a base de código |
| Tailwind CSS | 4.x | Utilitários CSS (uso mínimo — estilos via inline style) |

### 1.2 Estado e Dados
| Tecnologia | Versão | Papel |
|---|---|---|
| Zustand | 5.0.x | Estado global: documentos, configurações de IA |
| Zustand/persist | incluso | Persistência seletiva (settings) em localStorage |

### 1.3 Processamento Fiscal
| Tecnologia | Versão | Papel |
|---|---|---|
| fast-xml-parser | 5.8.x | Parsing de XMLs fiscais (NF-e, CT-e, NFS-e, NFC-e) |
| JSZip | 3.10.x | Extração de arquivos ZIP de XMLs |

### 1.4 Exportação
| Tecnologia | Versão | Papel |
|---|---|---|
| SheetJS (xlsx) | 0.18.x | Exportação Excel (.xlsx) — uso exclusivo de escrita |

### 1.5 Visualização
| Tecnologia | Versão | Papel |
|---|---|---|
| Recharts | latest | Gráficos: ComposedChart, AreaChart, BarChart |
| Lucide React | 0.513.x | Ícones SVG |

### 1.6 IA e Dossiê
| Tecnologia | Versão | Papel |
|---|---|---|
| Google Gemini API | REST v1beta | LLM para geração do dossiê tributário |
| react-markdown | 10.x | Renderização de Markdown nas respostas da IA |
| remark-gfm | latest | Plugin GFM para tabelas em Markdown |

### 1.7 Autenticação
| Tecnologia | Versão | Papel |
|---|---|---|
| Supabase Auth | via @supabase/supabase-js | Autenticação email/senha |
| @supabase/ssr | latest | Cliente server-side para refresh de sessão |
| Next.js Middleware | incluso | Proteção de rotas no Edge Runtime |

### 1.8 Tipografia (local, sem CDN)
| Tecnologia | Papel |
|---|---|
| @fontsource/outfit | Fonte UI principal (substituiu Google Fonts CDN) |
| @fontsource/ibm-plex-mono | Fonte monospace para dados fiscais |

### 1.9 Testes
| Tecnologia | Versão | Papel |
|---|---|---|
| Vitest | 4.x | Framework de testes unitários |
| @testing-library/react | 16.x | Testes de componentes React |
| @vitest/coverage-v8 | 4.x | Cobertura de código |

### 1.10 Infraestrutura
| Serviço | Papel |
|---|---|
| Vercel | Deploy, Edge Runtime, variáveis de ambiente |
| Supabase (São Paulo) | Autenticação de usuários (auth.users) |
| Google AI Studio | Chave gratuita para API do Gemini |
| GitHub | Repositório e CI/CD |

---

## 2. Arquitetura da Aplicação

### 2.1 Diagrama de Camadas

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  src/app/          (Next.js App Router — páginas)        │
│  src/components/   (React components reutilizáveis)      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   APPLICATION LAYER                      │
│  src/application/services/   (lógica de negócio pura)   │
│  src/application/store/      (estado global — Zustand)   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                    │
│  src/infrastructure/parsers/  (parsing de XMLs)         │
│  src/app/api/                 (Route Handlers — server)  │
│  src/lib/supabase/            (clientes Supabase)        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    DOMAIN LAYER                          │
│  src/domain/models/   (tipos e interfaces centrais)     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de Arquivos Completa

```
proj/
├── src/
│   ├── middleware.ts                    ← Auth: protege todas as rotas
│   │
│   ├── app/                             ← Next.js App Router
│   │   ├── layout.tsx                   ← Root layout (Sidebar + Header)
│   │   ├── globals.css                  ← Design tokens + estilos base
│   │   ├── page.tsx                     ← Upload de XMLs (rota /)
│   │   ├── explorer/page.tsx            ← Explorador de documentos
│   │   ├── analysis/page.tsx            ← Apuração RTC (KPIs + gráfico CFOP)
│   │   ├── temporal/page.tsx            ← Análise temporal (mensal/trimestral)
│   │   ├── reports/page.tsx             ← Conformidade (inconformidades)
│   │   ├── ai/page.tsx                  ← Dossiê Tributário (Gemini)
│   │   ├── settings/page.tsx            ← Configurações (modelo, logo)
│   │   ├── login/
│   │   │   ├── page.tsx                 ← Wrapper com Suspense
│   │   │   ├── LoginForm.tsx            ← Formulário de autenticação
│   │   │   └── layout.tsx               ← Layout isolado (sem Sidebar)
│   │   ├── auth/callback/route.ts       ← OAuth callback (futuro)
│   │   └── api/
│   │       └── ai/
│   │           ├── route.ts             ← Streaming Gemini (POST)
│   │           └── status/route.ts      ← Status da chave (GET)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx              ← Navegação lateral (7 rotas)
│   │   │   └── Header.tsx               ← Usuário logado + logout
│   │   ├── ui/
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── upload/
│   │   │   └── UploadZone.tsx           ← Drag-and-drop de XMLs/ZIPs
│   │   ├── explorer/
│   │   │   └── DocumentDetailsModal.tsx
│   │   └── ai/
│   │       ├── AiContextPanel.tsx       ← Painel de transparência de dados
│   │       ├── AiChatInput.tsx          ← Campo de pergunta (legacy)
│   │       ├── AiResponsePanel.tsx      ← Resposta com streaming
│   │       ├── AiHistoryPanel.tsx       ← Histórico da sessão
│   │       └── AiReport.tsx             ← Dossiê renderizado + exportação
│   │
│   ├── application/
│   │   ├── services/
│   │   │   ├── TaxAnalyzerService.ts    ← Cálculo de IBS/CBS, agrupamentos
│   │   │   ├── ExportService.ts         ← Exportação Excel + CSV
│   │   │   └── AiContextService.ts      ← Guardião de privacidade da IA
│   │   └── store/
│   │       ├── useFiscalStore.ts        ← Documentos em memória (Zustand)
│   │       └── useAiStore.ts            ← Config IA + histórico (persist)
│   │
│   ├── infrastructure/
│   │   └── parsers/
│   │       ├── IXmlParser.ts            ← Interface dos parsers
│   │       ├── DocumentDetector.ts      ← Detecção automática de tipo
│   │       ├── ParserFactory.ts         ← Factory de parsers
│   │       ├── ParserNFe.ts             ← NF-e v4.0 (LC 214/2025)
│   │       ├── ParserNFCe.ts            ← NFC-e v4.0
│   │       ├── ParserCTe.ts             ← CT-e v3.0
│   │       └── ParserNFSe.ts            ← NFS-e
│   │
│   ├── domain/
│   │   └── models/
│   │       ├── FiscalDocument.ts        ← Tipos centrais do domínio
│   │       └── AiTypes.ts               ← Tipos do módulo de IA
│   │
│   └── lib/
│       ├── utils.ts                     ← formatBRL, formatPercent
│       └── supabase/
│           ├── client.ts                ← createBrowserClient
│           └── server.ts                ← createServerClient (SSR)
│
├── tests/
│   ├── parsers/                         ← Testes de parsing XML
│   ├── services/                        ← Testes de serviços
│   └── fixtures/                        ← XMLs de teste (NF-e, CT-e, etc.)
│
├── docs/                                ← Esta documentação
├── middleware.ts → src/middleware.ts    ← (deve estar em src/ no Next.js 15)
├── next.config.ts                       ← Security headers, ESLint config
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Fluxo de Dados

### 3.1 Processamento de XMLs (client-side)

```
Usuário seleciona arquivos
        ↓
UploadZone.tsx (drag & drop)
        ↓
JSZip (se .zip) → extrai XMLs individuais
        ↓
DocumentDetector → identifica tipo (NFe/CTe/NFSe/NFCe)
        ↓
ParserFactory → instancia parser correto
        ↓
Parser específico → extrai campos + tags IBS/CBS
        ↓
FiscalDocument[] → useFiscalStore (memória)
        ↓
TaxAnalyzerService → calculateApuracao() → KPIs
```

### 3.2 Geração do Dossiê (server-side)

```
Usuário clica "Gerar Dossiê"
        ↓
AiContextService.buildAiContext(documents)
  → Detecta regime (OUTBOUND docs)
  → Detecta B2B/B2C (receivers)
  → Agrega estatísticas (sem CNPJs individuais)
  → Retorna AiContext limpo
        ↓
POST /api/ai { context, model, maxTokens }
  → Middleware valida sessão (cookie)
  → Route Handler: GEMINI_API_KEY de process.env
  → buildReportPrompt(context) → prompt contextualizado
  → fetch Gemini API (streaming SSE)
  → ReadableStream → browser
        ↓
ai/page.tsx → consome stream
  → setStreamText(chunk) em tempo real
  → AiReport renderiza com react-markdown + remark-gfm
        ↓
Exportar HTML / Imprimir PDF
```

### 3.3 Fluxo de Autenticação

```
Qualquer URL da aplicação
        ↓
src/middleware.ts (Edge Runtime)
  → isPublicPath()? → /login, /auth, /_next → passar
  → hasSupabaseSession(cookies)? → não → redirecionar /login
  → sim → passar
        ↓
/login → LoginForm.tsx
  → supabase.auth.signInWithPassword()
  → sucesso → window.location.href = redirectTo || '/'
        ↓
Sessão ativa → cookies httpOnly gerenciados pelo Supabase SSR
        ↓
Logout: Header.tsx
  → supabase.auth.signOut()
  → window.location.href = '/login' (navegação completa, não SPA)
```

---

## 4. Modelo de Dados

### 4.1 FiscalDocument (domínio principal)

```typescript
interface FiscalDocument {
  access_key:     string           // Chave de acesso (44 dígitos)
  document_type:  'NFE'|'NFCE'|'CTE'|'NFSE'
  version:        string
  issue_date:     string           // ISO 8601
  purpose:        'NORMAL'|'COMPLEMENTAR'|'AJUSTE'|'DEVOLUCAO'
  tax_regime:     'RPA'|'SIMPLES_NACIONAL'|'MEI'
  direction:      'INBOUND'|'OUTBOUND'  // entrada ou saída
  issuer:         { cnpj_cpf: string; name: string }
  receiver:       { cnpj_cpf: string; name: string }
  total_value:    number
  totals:         { vIBS?: number; vCBS?: number; [key: string]: number|undefined }
  items:          FiscalItem[]
  status:         'VALID'|'CANCELLED'|'DENIED'
  source_filename: string
  raw_xml:        string           // mantido em memória, nunca transmitido
}

interface FiscalItem {
  item_number:    number
  description:    string
  cfop:           string           // Código Fiscal de Operações
  ncm:            string
  gross_value:    number
  net_value:      number
  rtc:            { vIBS?: number; vCBS?: number }
  rtc_impact:     'CREDIT'|'DEBIT'|'NONE'
}
```

### 4.2 AiContext (privacidade garantida)

```typescript
interface AiContext {
  period:        string            // "Jan/26 – Mai/26"
  totalDocs:     number
  volumes:       { inbound: number; outbound: number; total: number }
  ibscbs:        { credito: number; debito: number; saldo: number;
                   creditRate: number; debitRate: number; balanceRate: number }
  byDocType:     Array<{ tipo: string; count: number; credito: number; debito: number }>
  byRegime:      { rpa: number; simples: number; mei: number }
  inconformes:   number
  topCfops:      Array<{ cfop: string; credito: number; debito: number }>
  temporal:      Array<{ label: string; credito: number; debito: number; saldo: number }>
  companyRegime: 'RPA'|'SIMPLES_NACIONAL'|'MEI'|'UNKNOWN'
  purchaseProfile: { withCredits: number; neutral: number; creditCoverageRate: number }
  salesProfile:    { b2b: number; b2c: number; b2bRate: number }
  // NUNCA INCLUIR: CNPJs, nomes de empresas, chaves de acesso
}
```

---

## 5. Segurança

### 5.1 Headers HTTP (next.config.ts)

```
X-Frame-Options: DENY                     → Anti-clickjacking
X-Content-Type-Options: nosniff           → Anti-MIME sniffing
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-DNS-Prefetch-Control: on
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### 5.2 Proteção de Chaves de API

| Chave | Onde fica | Como é acessada |
|---|---|---|
| GEMINI_API_KEY | Vercel Environment Variables (servidor) | `process.env` no Route Handler; nunca no browser |
| NEXT_PUBLIC_SUPABASE_URL | Vercel + browser | Projetada para uso público (sem dados) |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Vercel + browser | Chave anon; protegida por RLS do Supabase |

### 5.3 Validações de Segurança no Route Handler (/api/ai)

- Verificação de variáveis de ambiente antes de qualquer operação
- Validação de origem: `*.vercel.app` ou `localhost`
- Validação de payload: tamanho máximo 20KB
- Tratamento de todos os erros HTTP do Gemini (429, 403, 500)
- SSE buffering correto (previne truncamento de resposta)

### 5.4 Privacidade da IA

O `AiContextService` é o guardião: constrói o contexto enviado ao Gemini com **apenas estatísticas agregadas**. Auditado por testes automatizados:

```typescript
// Teste de privacidade: CNPJ nunca aparece no contexto
const violations = auditContextPrivacy(context, documents)
expect(violations).toHaveLength(0)
```

### 5.5 Análise de Vulnerabilidades Realizada

| Vetor | Status | Mitigação |
|---|---|---|
| XXE (XML External Entity) | ✅ Seguro | fast-xml-parser rejeita entidades externas |
| XML Bomb (Billion Laughs) | ✅ Seguro | Entidades internas não expandidas |
| Prototype Pollution (xlsx) | ✅ N/A | Usamos apenas XLSX.writeFile, não read |
| XSS via dangerouslySetInnerHTML | ✅ Seguro | Não existe no código |
| Segredos hardcoded | ✅ Seguro | Zero keys no código |
| DoS por ZIP gigante | ✅ Aceitável | Client-side; afeta apenas o browser do usuário |
| CSRF no Route Handler | ⚠️ Parcial | Verificação de origem; CSRF token planejado para v2 |
| esbuild CVE (dev) | ✅ Resolvido | Vitest v4 atualizado |

### 5.6 Autenticação (Supabase)

- Email/senha com hash bcrypt gerenciado pelo Supabase
- Sign Up desabilitado: usuários criados exclusivamente pelo administrador
- Confirmação de email desabilitada (uso interno)
- Sessão gerenciada via cookies httpOnly pelo @supabase/ssr
- Middleware verifica cookie de sessão em **todas** as rotas
- Logout usa `window.location.href` (não SPA) para garantir limpeza de cookies

---

## 6. Testes

### 6.1 Suíte de Testes (118 testes, 8 arquivos)

| Arquivo | Testes | Cobertura |
|---|---|---|
| ParserNFe.test.ts | ~20 | Parsing NF-e v4.0, IBS/CBS, multi-item, exportação |
| ParserNFCe.test.ts | ~11 | Parsing NFC-e, consumidor anônimo e identificado |
| ParserCTe.test.ts | ~15 | Parsing CT-e, frete interestadual |
| ParserNFSe.test.ts | ~10 | Parsing NFS-e, serviços |
| DocumentDetector.test.ts | ~6 | Detecção automática de tipo |
| TaxAnalyzerService.test.ts | ~20 | Cálculo de apuração, índices, agrupamentos |
| TaxAnalyzerService.temporal.test.ts | ~22 | Agrupamento mensal/trimestral, highlights |
| AiContextService.test.ts | ~14 | Privacidade, regime, B2B/B2C, matemática |

### 6.2 Fixtures de Teste

```
tests/fixtures/
├── nfe/
│   ├── nfe_rpa_com_ibs.xml         ← NF-e RPA com IBS/CBS destacado
│   ├── nfe_simples_sem_ibs.xml     ← NF-e Simples sem IBS/CBS
│   ├── nfe_interestadual_ibs.xml   ← NF-e interestadual
│   ├── nfe_exportacao_multi_item.xml
│   └── nfe_remessa_bonificacao.xml
├── nfce/
│   ├── nfce_consumidor_anonimo.xml
│   ├── nfce_consumidor_identificado.xml
│   └── nfce_multi_item.xml
├── cte/
│   ├── cte_rpa_com_ibs.xml
│   ├── cte_rpa_alto_valor.xml
│   └── cte_interestadual.xml
└── nfse/
    ├── nfse_com_ibscbs.xml
    └── nfse_sem_ibscbs.xml
```

### 6.3 Execução dos Testes

```bash
npm test                 # rodar todos os testes
npm run test:coverage    # com relatório de cobertura
npm run build            # validação TypeScript + Next.js build
```

---

## 7. Variáveis de Ambiente

### 7.1 Servidor (Vercel — nunca no browser)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GEMINI_API_KEY` | Sim | Chave do Google AI Studio (Free Tier) |

### 7.2 Browser + Servidor (NEXT_PUBLIC_)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon pública do Supabase |

### 7.3 Opcionais

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Domínio customizado (para verificação de origem no Route Handler) |

---

## 8. Deploy

### 8.1 Vercel (produção)

```bash
# Build automático via GitHub Actions
# Qualquer push para main → deploy automático
git push origin main
```

### 8.2 Local (desenvolvimento)

```bash
npm install
cp .env.example .env.local   # preencher com chaves reais
npm run dev                   # http://localhost:3000
```

### 8.3 Configuração Supabase

1. Criar projeto em supabase.com → região South America (São Paulo)
2. Authentication → Providers → Email → desabilitar "Enable Email Confirmations"
3. Authentication → Providers → Email → desabilitar "Enable Sign Up"
4. Authentication → Users → Add user (criar usuário manualmente)
5. Settings → API → copiar Project URL e anon key → adicionar no Vercel


# Guia de Contribuição e Continuidade
## Simples Apuração RTC

---

## Para o Próximo Desenvolvedor (ou IA)

Este documento contém tudo que você precisa saber para continuar o projeto.

---

## Contexto Rápido

**O que é:** ferramenta web para apuração de IBS/CBS (Reforma Tributária do Consumo brasileira, LC 214/2025). Processa XMLs fiscais localmente no browser e gera dossiê tributário com IA (Gemini).

**Onde roda:** Vercel (ebpos-simples-apuracao-rtc.vercel.app)

**Repositório:** https://github.com/CamargoRomuloNegi/Simples-Apuracao-RTC

---

## Setup em 5 Minutos

```bash
# 1. Clonar e instalar
git clone https://github.com/CamargoRomuloNegi/Simples-Apuracao-RTC
cd Simples-Apuracao-RTC
npm install

# 2. Configurar variáveis de ambiente
cat > .env.local << EOF
GEMINI_API_KEY=AIza...          # Google AI Studio (aistudio.google.com)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EOF

# 3. Rodar
npm run dev
# Abrir http://localhost:3000
# Login com usuário criado no Supabase Authentication > Users
```

---

## Antes de Qualquer Mudança

```bash
# Rodar testes (deve ser 118/118)
npm test

# Build deve ser limpo
npm run build
```

**Regra:** nunca entregar código com testes falhando ou build com erro.

---

## Padrões do Projeto

### TypeScript
- Strict mode ativo — sem `any` implícito
- Todos os tipos em `src/domain/models/`
- Funções de serviço são **puras** (recebem parâmetros, não leem store)

### Componentes
- `'use client'` apenas quando necessário (interatividade/hooks)
- Estilo via inline style com tokens CSS (`var(--color-primary)` etc.)
- Design tokens definidos em `src/app/globals.css`

### Privacidade (regra inviolável)
- `AiContextService.ts` NUNCA inclui CNPJs ou nomes no AiContext
- Qualquer novo campo no AiContext deve ser auditado em testes
- Rodar `auditContextPrivacy()` nos testes antes de adicionar campos

### Testes
- Novo serviço → novo arquivo de teste em `tests/services/`
- Parser novo → fixture XML + arquivo de teste em `tests/parsers/`
- Cobertura mínima: todos os caminhos críticos de parsing

---

## Armadilhas Conhecidas (Lições Aprendidas)

### ⚠️ Middleware deve estar em `src/middleware.ts`
Em Next.js 15 com diretório `src/`, o middleware na **raiz do projeto** é silenciosamente ignorado. O `middleware-manifest.json` fica vazio e o Vercel mostra 0 invocações. **Sempre em `src/`.**

### ⚠️ @supabase/ssr incompatível com Vercel Edge Runtime
Não importar `@supabase/ssr` no middleware — causa erro silencioso de compilação. O middleware atual usa leitura direta de cookies (síncrono, sem dependências).

### ⚠️ Logout deve usar `window.location.href`, não `router.push()`
`router.push()` é SPA navigation — o middleware avalia cookies antes de serem limpos pelo `signOut()`. `window.location.href` força HTTP request completo.

### ⚠️ SSE do Gemini: buffer por `\n\n`, não por `\n`
O streaming SSE pode chegar em chunks TCP que dividem eventos no meio. Acumular em buffer e processar apenas ao encontrar `\n\n`.

### ⚠️ react-markdown sem remark-gfm não renderiza tabelas
Adicionar `remarkPlugins={[remarkGfm]}` em todo componente que renderiza output da IA.

### ⚠️ Sidebar: o array NAV deve ser verificado após qualquer mudança
Bug histórico: substituição de texto via script falhou silenciosamente e o item Temporal nunca entrou no array. Sempre verificar o NAV array visualmente após mudanças na Sidebar.

---

## Variáveis de Ambiente

| Variável | Onde Configurar | Nunca em |
|---|---|---|
| `GEMINI_API_KEY` | Vercel Env Vars (Production) | Código, .env.development |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + .env.local | Código |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + .env.local | Código |

---

## Adicionar um Novo Usuário

1. Acessar painel Supabase → Authentication → Users
2. Clicar "Add user" → informar email e senha
3. O usuário pode fazer login imediatamente (sem confirmação de email)

---

## Adicionar um Novo Parser (ex: MDF-e)

1. Criar `src/infrastructure/parsers/ParserMDFe.ts` implementando `IXmlParser`
2. Adicionar ao `DocumentDetector.ts` (lista de tags identificadoras)
3. Adicionar ao `ParserFactory.ts` (mapeamento tipo → parser)
4. Criar fixture em `tests/fixtures/mdfe/mdfe_exemplo.xml`
5. Criar `tests/parsers/ParserMDFe.test.ts` com casos de teste
6. Rodar `npm test` — deve passar

---

## Estrutura de Prompt da IA

O prompt do dossiê está em `src/app/api/ai/route.ts` → `buildReportPrompt()`.

Ele tem duas partes:
1. **Instrução de regime** (dinâmica): adapta a análise a RPA, Simples+B2B, Simples+B2C
2. **Dados formatados** (texto legível, não JSON): período, volumes, IBS/CBS, CFOPs, temporal

Para melhorar o dossiê: refinar as instruções de cada seção ou adicionar novos dados ao `AiContext` (lembrar de auditar privacidade).

---

## Modelos Gemini Disponíveis (junho/2026)

| Modelo | Free Tier | Uso recomendado |
|---|---|---|
| `gemini-3.5-flash` | ✅ | Padrão — melhor qualidade |
| `gemini-2.5-flash` | ✅ | Raciocínio mais profundo |
| `gemini-2.5-flash-lite` | ✅ | Mais rápido para testes |

**Não usar:** `gemini-2.0-flash` (desligado jun/2026), `gemini-1.5-flash` (legado).


# HANDOFF — Simples Apuração RTC

> Para retomar numa sessão nova **dentro do devcontainer**. Leia também `CLAUDE.md`.
> Última atualização: **fim da F0.3** (remover mocks + identidade de produto + specs legado marcados).

## ⚠️ Leia primeiro (crítico)
- **Esta sessão rodou no HOST.** A memória do orquestrador fica em `~/.claude` do host e **não** estará disponível dentro do container — **este HANDOFF.md + CLAUDE.md são a fonte de verdade.**
- **Rode TUDO dentro do devcontainer** (regra de ouro nº 9). Reabra: VS Code → *"Dev Containers: Reopen in Container"* (Docker Desktop ligado). O `post-create` instala deps do `backend/requirements.txt`, do `frontend/` e o Chromium do Playwright.
- **Tools `Grep`/`Glob` dedicados NÃO existem neste harness** — use `Bash` (`find`/`grep`/`rg`) e `Read`.
- **Orquestrador:** só delega aos subagents nomeados em `.claude/agents/`. **Proibido `general-purpose`.**

## 🔒 Regras de Git (obrigatórias)
- **Branch única `develop`. NUNCA commitar/empurrar na `main`.**
- **NÃO fazer push enquanto o repo for público.** `origin = zecacontabilidade/ApuracaoAssistidade_IBS_CBS_v1` está **público** e contém doc "Confidencial"; a conta `matheusfurtado` tem **WRITE, não admin** (não dá para tornar privado via `gh`). Aguardando o dono tornar privado (UI) ou criar repo privado novo.
- **Local-only (gitignored), não versionar:** `.claude/agents/`, `.claude/skills/`, `ArquivosProjeto/PROMPT_CLAUDE_CODE_Time_de_Agentes.md`. Só `.claude/settings.json` é versionado. (Os agents/skills existem no disco e são usados normalmente.)
- **Sem commit/push sem aprovação humana explícita** (skill `portao-de-commit`).

## ✅ Status atual (branch `develop`, commits LOCAIS — nada empurrado)
- `210aa3a` chore: bootstrap (CLAUDE.md, .claude/settings.json, diagnóstico .docx, .gitignore)
- `6239d29` docs: **F0.1 fundação** — 7 ADRs + contrato API + modelo de dados + backlog
- `443e1e8` chore(devcontainer): **F0.0** — ambiente validado
- `5e86f19` chore(repo): **F0.2** — higiene + reorg monorepo backend/+frontend/

**F0.1 (fundação) — DONE.** `docs/adr/0001-0007`, `docs/api/contrato-api-v1.md`, `docs/data-model.md`, `docs/backlog-fatias.md`.
**F0.0 (devcontainer) — DONE e validado** (`docker compose build` + todos `healthy`: db/redis/minio; app+worker no ar; conectividade ok). `.devcontainer/*`, `backend/.env.example`, `docs/devcontainer-assessment.md`. Gates: testes=smoke do ambiente verde; LGPD=N/A; custo=N/A (local); revisão final aprovada (revisor-codigo sem críticos + arquiteto aceite); ajustes M1/M2/B1/B2 aplicados.

**F0.2 (reorg monorepo) — DONE.** Protótipo movido de raiz para `frontend/` (src/, index.html, vite.config.ts, package.json, assets/, etc.); skeleton `backend/` com `requirements.txt`; `.dockerignore` adicionado; README refatorado; referências no `post-create.sh` ajustadas. `docker compose` sobe tudo `healthy` no container.

**F0.3 (remover mocks + identidade de produto) — DONE; commit PREPARADO, aguardando aprovação humana.** CNPJ/empresa fictícios e seeds do simulador zerados; identidade "AI Studio" removida (title/lang em index.html, metadata.json, server.ts User-Agent, vite.config.ts comentário, assets/.aistudio deletado); 8 docs em ArquivosProjeto marcados (LEGADO vs REFERÊNCIA HISTÓRICA VÁLIDA); `COMPILADO_EXEMPLOS` genericizado como sintético (label adicionado, deferido p/ F1.9); infra Vitest mínima + testes provando telas sem constantes; frontend/.env.example documentando GEMINI_API_KEY no servidor. Gates: testes Vitest 4/4 verde, revisao-lgpd APROVADO, revisao-final (revisor-codigo + arquiteto-lider) ACEITE.

## 🧭 Decisões travadas (ADRs em `docs/adr/`)
- Multitenancy = schema compartilhado + `organization_id` + **RLS FORCE** via GUC `app.current_org`; role de app sem BYPASSRLS (0001).
- Auth própria `fastapi-users` + JWT access/refresh + **argon2**; `users` global + `memberships` (RBAC owner/admin/membro); **sem Supabase** (0002).
- **Token org-scoped** (claim `org_id` via select-org) alimenta o RLS (0006).
- API `/api/v1`, erros **RFC 9457**, paginação **keyset**, `Idempotency-Key` em POSTs custosos (0003).
- PK **UUID v7** (gerada na app); dinheiro em `numeric` (0007).
- Monorepo **`backend/` + `frontend/`**; `fiscal_engine` puro com fronteira por import-linter (0004).
- Fila = **Dramatiq + Redis** atrás de porta `TaskQueue` portável p/ SQS (0005).
- Nome do produto: **"Simples Apuração RTC"**.

## ❓ Decisões pendentes (confirmar na fatia que precisar — não bloqueiam F0.4)
- Postgres gerenciado não-Supabase (Neon/Aurora/Cloud SQL) — F4/FinOps.
- Provedor de e-mail (verificação/convite/reset) — F1.3.
- Stripe vs gateway BR — F3.
- Retenção do XML bruto + cifragem de CPF + base legal LGPD — F1.x/F2 (com `oficial-lgpd`).
- Versionar `.claude/settings.json`? (hoje sim; trivial tirar se quiser).

## 🧹 Dívidas técnicas / pendências de código (registradas na revisão da F0.3)
- `frontend/server.ts` legado (Express + proxy do Gemini em `POST /api/analyze`) ainda presente; o front ainda chama `/api/analyze`. Substituir pelo backend FastAPI com o sub-processador de IA sob controles LGPD — **F1.8/F1.9/F1.10**.
- `@google/genai` ainda em `frontend/package.json` (usado só no `server.ts` legado). Remover/realocar quando a IA migrar para o servidor — **F1.9/F1.10**.
- **Lógica fiscal ainda no cliente** (`App.tsx`/`XmlUploader.tsx` fazem parsing DOM e cálculo de alíquotas/valores IBS/CBS no browser). Migrar para o motor Python puro — **F0.7/F1.5+** (dívida arquitetural principal).
- `COMPILADO_EXEMPLOS` (dataset DEMO sintético em `XmlUploader.tsx`) → substituir por amostras via API na **F1.9**. Bug conhecido: os campos do dataset (`emit_name`/`dest_name`/`emit`/`dest`) não batem com o consumo (`emitente`/`destinatario`) → a coluna origem/destino renderiza `undefined` ao "Carregar Dataset de Exemplo"; normalizar na **F1.9**.
- Base **Vitest** mínima já adicionada na F0.3 (vitest, @testing-library, jsdom, coverage-v8, setup). A **F0.5** deve ESTENDER (ESLint, Prettier, `tsc` strict, threshold de cobertura ≥70%), **não re-adicionar**.
- `frontend/metadata.json` é artefato do AI Studio (`majorCapabilities` zerado); considerar remover em higiene futura.

## ▶️ PRÓXIMOS PASSOS (uma fatia por vez, pelos gates)
Fluxo por fatia: `/iniciar-fatia` → especialista implementa → `/piramide-de-testes` → `/revisao-lgpd` (se tocar dados) → `/revisao-final` (revisor-codigo + arquiteto-lider) → `/portao-de-commit` (PARA p/ aprovação). Cobertura: motor ≥95%, demais ≥80%, front ≥70%.

**1) F0.4 — Tooling de qualidade backend** · dono **devops-finops** (+`engenheiro-backend`) · P
   - `pyproject.toml`: setup do projeto Python 3.12+.
   - **Ruff** (lint + format): configurado, passando no `backend/`.
   - **mypy ou pyright**: type-check stricto.
   - **pytest + coverage**: framework + cobertura mínima (motor ≥95%, demais ≥80%).
   - **pre-commit**: hooks de lint/format/type-check locais.
   - DoD: `ruff` sem erros; `mypy/pyright` sem erros; `pytest --cov` rodam no container; thresholds de cobertura configurados no `pyproject.toml` (não é teste de produto ainda, é só a pipeline local).

**Sequência depois:** F0.5 (tooling frontend: ESLint/Prettier/tsc strict/Vitest com ≥70% cobertura, pode correr em paralelo) → F0.6 (CI GitHub Actions) → **F0.7 (motor de apuração puro — engenheiro-motor-fiscal, alto valor)** → **Fase 1** (scaffold FastAPI, dados núcleo+Alembic+RLS, auth JWT, parsers XML anti-XXE, ingestão+apuração, IA Gemini no servidor, frontend consumindo a API). Backlog completo em `docs/backlog-fatias.md`.

## 📌 Fontes de verdade
`CLAUDE.md` (regras) · `docs/backlog-fatias.md` · `docs/data-model.md` · `docs/api/contrato-api-v1.md` · `docs/adr/*` · `docs/devcontainer-assessment.md`. Specs em `ArquivosProjeto/*.md` têm partes **LEGADO** (Next.js/Supabase/cálculo no browser) — **marcadas na F0.3** (banners LEGADO vs REFERÊNCIA HISTÓRICA VÁLIDA); vale a stack de `CLAUDE.md` + diagnóstico.

---

## 🔁 Prompt de retomada (colar na sessão nova, dentro do container)
```
Retome o projeto "Simples Apuração RTC" como ORQUESTRADOR, rodando DENTRO do devcontainer.
Leia HANDOFF.md e CLAUDE.md antes de tudo. Continue a partir de PRÓXIMOS PASSOS — próxima
fatia: F0.4 (tooling de qualidade backend), dono devops-finops. Uma fatia por vez pelos
gates (/iniciar-fatia → especialista → /piramide-de-testes → /revisao-lgpd se tocar dados →
/revisao-final → /portao-de-commit). Regras: só na branch develop (NUNCA main); não comite/
empurre sem minha aprovação; NÃO empurre enquanto o repo for público; não use agentes
genéricos; rode tudo dentro do devcontainer. Os tools Grep/Glob não existem — use Bash find/grep.
Apresente o mini-plano da F0.4 e siga.
```

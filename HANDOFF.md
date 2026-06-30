# HANDOFF — Simples Apuração RTC

> Para retomar numa sessão nova **dentro do devcontainer**. Leia também `CLAUDE.md`.
> Última atualização: **fim da F0.4** (tooling de qualidade backend + ADR 0008 layout/cwd).

## ⚠️ Leia primeiro (crítico)
- **Rode TUDO dentro do devcontainer** (regra de ouro nº 9). Reabra: VS Code → *"Dev Containers: Reopen in Container"* (Docker Desktop ligado). O `post-create` instala o backend em editable (`pip install -e "backend[dev,test]"`), deps do `frontend/`, o Chromium do Playwright e roda `pre-commit install`.
- **cwd canônico do tooling backend = `/workspace/backend`** (ADR 0008 / Opção B). Comandos: `cd /workspace/backend && pytest` / `ruff check .` / `ruff format .` / `mypy .`. O `pre-commit` roda da raiz (`/workspace`): `pre-commit run --all-files`. **Ordem importa:** `pip install -e "backend[dev,test]"` precisa rodar antes de `pre-commit` (hooks ruff/mypy usam `language: system`).
- **Tools `Grep`/`Glob` dedicados podem falhar neste harness** — use `Bash` (`find`/`grep`/`rg`) e `Read`.
- **Orquestrador:** só delega aos subagents nomeados em `.claude/agents/`. **Proibido `general-purpose`.**

## 🔒 Regras de Git (obrigatórias)
- **Branch única `develop`. NUNCA commitar/empurrar na `main`.**
- **Push de `develop` autorizado (auditado); dados confidenciais purgados.** `origin/develop` existe e é rastreada (push autorizado em auditoria de credenciais). A doc interna "Confidencial" (`ArquivosProjeto/Avaliacao_Tecnica_Simples_Apuracao_RTC.docx`) foi **purgada da história git** (via `git filter-branch`) e do object store, agora é gitignored e local-only — NÃO está no repo público. Policy: empurre `develop` após rodar auditoria de credenciais (não há segredos expostos); **NUNCA `main`**.
- **Local-only (gitignored), não versionar:** `.claude/agents/`, `.claude/skills/`, `ArquivosProjeto/` (histórico purgado, confidencial local). Só `.claude/settings.json` é versionado.
- **Sem commit/push sem aprovação humana explícita** (skill `portao-de-commit`).

## ✅ Status atual (branch `develop`, commits LOCAIS — nada empurrado)
- `210aa3a` chore: bootstrap (CLAUDE.md, .claude/settings.json, diagnóstico .docx, .gitignore)
- `6239d29` docs: **F0.1 fundação** — 7 ADRs + contrato API + modelo de dados + backlog
- `443e1e8` chore(devcontainer): **F0.0** — ambiente validado
- `a8d837d` chore(devcontainer): persiste credenciais Claude CLI entre rebuilds
- `5e86f19` chore(repo): **F0.2** — higiene + reorg monorepo backend/+frontend/
- `04e43a9` chore(frontend): **F0.3** — remove mocks + identidade de produto; specs legado marcados
- `6412975` chore(backend): **F0.4** — tooling de qualidade (pyproject/ruff/mypy/pytest/pre-commit) + ADR 0008
- `1e1492e` style(repo): **F0.4** — normaliza whitespace/EOF (1ª passada do pre-commit)

**F0.0/F0.1/F0.2/F0.3 — DONE** (ver histórico abaixo).

**F0.4 (tooling de qualidade backend) — DONE; 2 commits.** `backend/pyproject.toml` (PEP 621: deps migradas de requirements.txt → fonte única; extras `dev`/`test`); Ruff (lint+format, line-length 100); mypy `strict` (+plugins `pydantic.mypy`/`sqlalchemy.ext.mypy.plugin`); pytest + coverage; `.pre-commit-config.yaml` na raiz (higiene + ruff + mypy escopado a `backend/`); `post-create.sh` faz `pip install -e` + `pre-commit install`; `requirements.txt` virou shim documental; `backend/__init__.py` **removido** (ADR 0008). **ADR 0008** fixou o layout (Opção B). Gates: pirâmide verde (3 smoke tests; gate de cobertura `fail_under=80` **configurado e com dentes** — `pytest --cov=app --cov=fiscal_engine` falha em 0%, mas dormente no esqueleto pois `addopts` não tem `--cov` ainda); revisao-final (revisor-codigo SEM Críticos + arquiteto-lider ACEITE); LGPD/AWS N/A. Cobertura **vacuosa** no esqueleto por design (sem código de produto) — ativa quando os pacotes existirem.

**F0.5 (tooling de qualidade frontend) — DONE.** `frontend/eslint.config.js` (flat ESLint 9: typescript-eslint + react + hooks + refresh + prettier-config, Opção B strict by default com `legacyOverrides` para 3 arquivos legado); `frontend/.prettierrc.json` (printWidth 100, lf); `frontend/tsconfig.json` (`strict: true` + `noUnusedLocals/Parameters: true`); `frontend/vite.config.ts` (Vitest v8, threshold ≥70%, estratégia dormente espelhando F0.4); `frontend/package.json` (scripts lint/format/typecheck/test + deps faltantes `@types/react*`); `.pre-commit-config.yaml` estendido com hooks eslint+prettier (language: system, escopados a `frontend/`, dependem de `npm install`). README atualizado (seção "Qualidade do frontend"). Gates: pirâmide verde (lint/format/type/test rodam no container); revisao-final (revisor-codigo + arquiteto-lider ACEITE Opção B — strict novo, warns legado); LGPD/AWS N/A.

### Histórico resumido F0.0–F0.3
**F0.0** devcontainer validado (db/redis/minio/app/worker healthy). **F0.1** fundação (ADRs 0001–0007, contrato API, data-model, backlog). **F0.2** reorg monorepo (`frontend/` + `backend/` skeleton). **F0.3** remoção de mocks/identidade AI Studio + specs legado marcados (Vitest 4/4).

## 🧭 Decisões travadas (ADRs em `docs/adr/`)
- Multitenancy = schema compartilhado + `organization_id` + **RLS FORCE** via GUC `app.current_org`; role de app sem BYPASSRLS (0001).
- Auth própria `fastapi-users` + JWT access/refresh + **argon2**; `users` global + `memberships` (RBAC owner/admin/membro); **sem Supabase** (0002).
- **Token org-scoped** (claim `org_id` via select-org) alimenta o RLS (0006).
- API `/api/v1`, erros **RFC 9457**, paginação **keyset**, `Idempotency-Key` em POSTs custosos (0003).
- PK **UUID v7** (gerada na app); dinheiro em `numeric` (0007).
- Monorepo **`backend/` + `frontend/`**; `fiscal_engine` puro com fronteira por import-linter (0004).
- **Layout/cwd do backend (0008 — NOVO na F0.4):** `backend/` é PASTA do monorepo, NÃO pacote Python. Pacotes top-level vivem DENTRO de `backend/`: `app/` (F1.0), `fiscal_engine/` (F0.7), `workers/` (F1.x). cwd canônico de tooling = `/workspace/backend`. Sem `package-dir`/`--cov-config` tricks. Worker = `python -m dramatiq app.tasks` (de `backend/`). Import-linter (F0.6/F0.7) referencia `fiscal_engine`/`app`, não `backend.*`.
- Fila = **Dramatiq + Redis** atrás de porta `TaskQueue` portável p/ SQS (0005).
- Nome do produto: **"Simples Apuração RTC"**.

## ❓ Decisões pendentes (confirmar na fatia que precisar)
- Postgres gerenciado não-Supabase (Neon/Aurora/Cloud SQL) — F4/FinOps.
- Provedor de e-mail (verificação/convite/reset) — F1.3.
- Stripe vs gateway BR — F3.
- Retenção do XML bruto + cifragem de CPF + base legal LGPD — F1.x/F2 (com `oficial-lgpd`).

## 🧹 Dívidas técnicas / pendências de código
**Novas da F0.5 (registradas em tooling frontend):**
- **F1.9 (limpeza do legado frontend):** deletar o bloco `legacyOverrides` inteiro do `eslint.config.js` (linhas 88–103), promover os `warn` do legado a `error` globalmente, remover os excludes de DIRETÓRIO (`src/components/**`, `src/utils/**`) do `vite.config.ts` e verificar ≥70% em todo `src/**`. **Critério de aceite:** todos os arquivos novos cobertos ou explicitamente ignorados por arquivo específico.

**Novas da F0.4 (registradas na revisão):**
- **Gate de cobertura por pacote:** ativar `--cov=fiscal_engine --cov-fail-under=95` em **F0.7** e `--cov=app` (≥80%) em **F1.0**; um único `--cov-fail-under` não expressa limiares por domínio. Os limiares já estão documentados no `pyproject.toml`.
- **Consolidar `fail_under` duplicado** (`[tool.coverage.report]` vs futuro `--cov-fail-under` no addopts) numa fonte só quando o gate do motor for ativado — **F0.7** (ACHADO 3).
- **CI (F0.6):** (a) adicionar step `npm ci --prefix frontend` (modo lockfile) ANTES do pre-commit para garantir node_modules no CI; (b) **decidir escopo de typecheck:** hoje só eslint+prettier estão no pre-commit do front, não tsc (assimetria vs mypy do backend) — F0.6 valida se entra no pre-commit ou fica só no CI; (c) **ACHADO de revisão (F0.5):** os excludes de cobertura são por DIRETÓRIO (`src/components/**`, `src/utils/**`) — código novo de F1.x que caia em `components/` fica silenciosamente fora; trocar por arquivos específicos (`src/components/XmlUploader.tsx`, `src/utils/pdfGenerator.ts`) em **F0.6**; materializar a fronteira do engine com **import-linter** (referenciando `fiscal_engine`/`app`, ADR 0008) e fixar `working-directory: backend` nos jobs; garantir step de `pip install -e "backend[dev,test]"` ANTES de `pre-commit`/ruff/mypy (hooks `language: system`).
- **Auto-referência do extra `dev`** → `simples-apuracao-rtc-backend[test]` por nome de distribuição; se o `name` mudar, atualizar nos dois lugares (baixo impacto).

**Herdadas (frontend/IA — F1.x):**
- `frontend/server.ts` legado (Express + proxy Gemini em `POST /api/analyze`); o front ainda chama `/api/analyze`. Migrar p/ backend FastAPI sob controles LGPD — **F1.8/F1.9/F1.10**.
- `@google/genai` ainda em `frontend/package.json` (só no `server.ts` legado) — remover/realocar na **F1.9/F1.10**.
- **Lógica fiscal ainda no cliente** (`App.tsx`/`XmlUploader.tsx` fazem parsing/cálculo no browser). Migrar para o motor Python puro — **F0.7/F1.5+** (dívida arquitetural principal).
- `COMPILADO_EXEMPLOS` (DEMO sintético em `XmlUploader.tsx`) → substituir por amostras via API na **F1.9**; bug conhecido: campos `emit_name`/`dest_name` não batem com o consumo (`emitente`/`destinatario`) → coluna origem/destino renderiza `undefined`; normalizar na **F1.9**.
- `frontend/metadata.json` é artefato do AI Studio; considerar remover em higiene futura.

## ▶️ PRÓXIMOS PASSOS (uma fatia por vez, pelos gates)
Fluxo por fatia: `/iniciar-fatia` → especialista implementa → `/piramide-de-testes` → `/revisao-lgpd` (se tocar dados) → `/revisao-final` (revisor-codigo + arquiteto-lider) → `/portao-de-commit` (PARA p/ aprovação). Cobertura: motor ≥95%, demais ≥80%, front ≥70%.

**Próxima: F0.6 — CI (GitHub Actions)** · dono **devops-finops** · M
   - Pipeline lint+type+test+build (backend e frontend), cache, import-linter (fronteira do engine), gates de cobertura.
   - Tarefas críticas: (a) `npm ci --prefix frontend` antes do pre-commit (diferente de `npm install`); (b) decidir se `tsc --noEmit` entra no pre-commit ou só no CI; (c) revisar excludes de cobertura — hoje são diretórios (`src/components/**`, `src/utils/**`), trocar por arquivos específicos legados (`src/components/XmlUploader.tsx`, `src/utils/pdfGenerator.ts`).
   - DoD: CI verde em PR; pipeline bloqueia merge com teste vermelho/cobertura baixa; `working-directory: backend` nos jobs; import-linter materializado.
   - Depende de: F0.4 + F0.5 (ambas feitas).

**Sequência depois:** **F0.7 (motor de apuração puro — engenheiro-motor-fiscal, alto valor; cria `backend/fiscal_engine/` e ativa o gate ≥95%)** → **Fase 1** (F1.0 scaffold FastAPI cria `backend/app/`; F1.1 dados+Alembic+RLS; F1.2–1.4 auth/RBAC; F1.5 parsers XML anti-XXE; F1.6–1.7 ingestão+apuração; F1.8 IA Gemini server-side; F1.9 frontend consumindo a API; F1.10 segredos). Backlog completo em `docs/backlog-fatias.md`.

## 📌 Fontes de verdade
`CLAUDE.md` (regras) · `docs/backlog-fatias.md` · `docs/data-model.md` · `docs/api/contrato-api-v1.md` · `docs/adr/*` (0001–0008) · `docs/devcontainer-assessment.md`. Specs em `ArquivosProjeto/*.md` têm partes **LEGADO** (Next.js/Supabase/cálculo no browser) — marcadas na F0.3; vale a stack de `CLAUDE.md` + diagnóstico.

---

## 🔁 Prompt de retomada (colar na sessão nova, dentro do container)
```
Retome o projeto "Simples Apuração RTC" como ORQUESTRADOR, rodando DENTRO do devcontainer.
Leia HANDOFF.md e CLAUDE.md antes de tudo. Continue a partir de PRÓXIMOS PASSOS — próxima
fatia: F0.5 (tooling de qualidade frontend), dono engenheiro-frontend. Uma fatia por vez pelos
gates (/iniciar-fatia → especialista → /piramide-de-testes → /revisao-lgpd se tocar dados →
/revisao-final → /portao-de-commit). Regras: só na branch develop (NUNCA main); não comite/
empurre sem minha aprovação; NÃO empurre enquanto o repo for público; não use agentes
genéricos; rode tudo dentro do devcontainer (tooling backend de /workspace/backend, ADR 0008).
Os tools Grep/Glob podem falhar — use Bash find/grep. Apresente o mini-plano da F0.5 e siga.
```

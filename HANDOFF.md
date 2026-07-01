# HANDOFF — Simples Apuração RTC

> Para retomar numa sessão nova **dentro do devcontainer**. Leia também `CLAUDE.md`.
> Última atualização: **fim da F0.7b** (apuração + conformidade IBS/CBS; ADR 0010). Fase 0 concluída exceto F0.6 (CI, adiada).

## ⚠️ Leia primeiro (crítico)
- **Rode TUDO dentro do devcontainer** (regra de ouro nº 9). Reabra: VS Code → *"Dev Containers: Reopen in Container"* (Docker Desktop ligado). O `post-create` instala o backend em editable (`pip install -e "backend[dev,test]"`), deps do `frontend/`, o Chromium do Playwright e roda `pre-commit install`.
- **cwd canônico do tooling backend = `/workspace/backend`** (ADR 0008 / Opção B). Comandos: `cd /workspace/backend && pytest` / `ruff check .` / `ruff format .` / `mypy .`. O `pre-commit` roda da raiz (`/workspace`): `pre-commit run --all-files`. **Ordem importa:** `pip install -e "backend[dev,test]"` precisa rodar antes de `pre-commit` (hooks ruff/mypy usam `language: system`).
- **Tools `Grep`/`Glob` dedicados podem falhar neste harness** — use `Bash` (`find`/`grep`/`rg`) e `Read`.
- **Orquestrador:** só delega aos subagents nomeados em `.claude/agents/`. **Proibido `general-purpose`.**

## 🔒 Regras de Git (obrigatórias)
- **Branch única `develop`. NUNCA commitar/empurrar na `main`.**
- **Push de `develop` autorizado (auditado); dados confidenciais purgados.** `origin/develop` existe e é rastreada (push autorizado em auditoria de credenciais). A doc interna "Confidencial" (`ArquivosProjeto/Avaliacao_Tecnica_Simples_Apuracao_RTC.docx`) foi **purgada da história git** (via `git filter-branch`) e do object store, agora é gitignored e local-only — NÃO está no repo público. Policy: **push de `develop` autorizado após auditoria de credenciais** (feito em 2026-07-01 — `origin/develop` = `8a825f2`; auditoria sem segredos, sem `.claude/agents|skills`). Repo **ainda público** — decisão de privacidade/fork segue pendente com o arquiteto. **NUNCA `main`**.
- **Local-only (gitignored), não versionar:** `.claude/agents/`, `.claude/skills/`; e em `ArquivosProjeto/` **apenas** o `.docx` confidencial (`Avaliacao_Tecnica_*`, purgado da história) e `PROMPT_CLAUDE_CODE_Time_de_Agentes.md`. ⚠️ **Os demais `.md` de `ArquivosProjeto/` (PRD/ROADMAP/SPEC_*/CONTRIBUTING) SÃO versionados e públicos** (decisão do usuário em 2026-07-01 — "deixar como está"). Em `.claude/`, só `.claude/settings.json` é versionado.
- **Sem commit/push sem aprovação humana explícita** (skill `portao-de-commit`).

## ✅ Status atual (branch `develop`; sincronizada com `origin/develop` — push autorizado; NUNCA `main`)
Histórico real recente (`git log --oneline`):
- `00280f2` docs(handoff): **F0.5** concluída
- `cc58fb0` chore(frontend): tooling de qualidade — eslint/prettier/tsc/vitest (**F0.5**)
- `91263a9` docs(handoff): **F0.4** concluída
- `91280d7` chore(backend): tooling de qualidade — pyproject/ruff/mypy/pytest/pre-commit (**F0.4**)
- `232e020` chore(frontend): remove mocks e identidade (**F0.3**)
- `978fbf3` chore(repo): higiene e reorg monorepo (**F0.2**)
- `ac9cc32` feat(fiscal-engine): motor de apuração puro — **F0.7a**
- _(este commit)_ feat(fiscal-engine): apuração + conformidade — **F0.7b**

**F0.0–F0.5 — DONE** (ver histórico abaixo). **F0.6 (CI) — ADIADA** (o DoD "CI verde em PR" exige push, hoje bloqueado pelo repo público). **F0.7a — DONE** (commit `ac9cc32`). **F0.7b — DONE neste commit.** Com isso a **Fase 0 está concluída exceto F0.6**.

**F0.4 (tooling de qualidade backend) — DONE.** `backend/pyproject.toml` (PEP 621; extras `dev`/`test`); Ruff (lint+format, line-length 100); mypy `strict` (+plugins pydantic/sqlalchemy); pytest + coverage; `.pre-commit-config.yaml` na raiz; `post-create.sh` faz `pip install -e` + `pre-commit install`; `backend/__init__.py` **removido** (ADR 0008).

**F0.5 (tooling de qualidade frontend) — DONE.** `frontend/eslint.config.js` (flat ESLint 9: typescript-eslint + react + hooks + refresh + prettier; Opção B strict by default com `legacyOverrides`); `.prettierrc.json`; `tsconfig.json` strict; `vite.config.ts` (Vitest, threshold ≥70%, dormente); `package.json` (scripts + deps); `.pre-commit-config.yaml` estendido (eslint+prettier escopados a `frontend/`). Gates: pirâmide verde; revisao-final (ACEITE Opção B — strict novo, warns legado); LGPD/AWS N/A.

**F0.7a (motor de apuração puro — tipos + regra de impacto RTC) — DONE.** Pacote puro `backend/fiscal_engine/` (sem IO/FastAPI/ORM/Pydantic; dataclasses frozen+slots; `Decimal` sempre; sem identidade direta — LGPD by design). Enums (`RtcImpact`={CREDIT,DEBIT,NEUTRAL}, `Direction`, `DocumentType`, `TaxRegime`, `DocumentPurpose`, `RtcReason`); modelos (`FiscalItem`, `FiscalDocument`, `RtcClassification`); regra `classify_rtc_impact`/`classify_item`/`is_excluded_cfop` com precedência **UNKNOWN > CFOP excluído {7,59,69,515,615} > destaque-zero > INBOUND(CREDIT)/OUTBOUND(DEBIT)**. Modelo travado = **SPEC_XML_MAPPING_v2** (direção econômica = único driver; CFOP só exclui) — **ADR 0009**; adendo ao ADR 0008 (cobertura por pacote). Catálogo de regras p/ validação SME: `docs/regras-negocio-fiscais.md`. Gates: pirâmide (**69 testes**, cobertura `fiscal_engine` **100%**, gate ≥95% com dentes; ruff/mypy limpos); revisao-lgpd (aprovado — `access_key` reclassificada como identificador indireto; dados sintéticos); revisao-final (revisor-codigo + arquiteto-lider aprovados; hardening ASCII/finitude aplicado).

**F0.7b (apuração + conformidade IBS/CBS) — DONE.** Novos `backend/fiscal_engine/conformity.py` (`assess_conformity`/`assess_item`) e `apuracao.py` (`apurar`/`_iter_assessable_units`/`_compute_index`/`_quantize_money`); enums `Conformity`/`ConformityReason`/`Granularity` + `TaxRegime`+=`SIMPLES_EXCESSO`; modelos `ItemConformity`/`InconformidadeRef`/`Apuracao`. **Saldo IBS e CBS SEPARADOS** (agregado só exibição, NUNCA liquidação); índices §6.2 (base `v_bc`, divisão-zero→`None`, com sinal, variantes `_ibs`/`_cbs` só no saldo); conformidade por **presença de destaque** (precedência data→reason→regime; MEI conservador→`NAO_AVALIADO`); CFOP via `reason` da F0.7a (sem whitelist); CT-e por **nível-documento**; `apurar` puro (caller deduplica/seleciona período). **ADR 0010** + bloco F0.7b no catálogo + gaps registrados em `data-model.md §7`. `TaxRateProvider` DIFERIDO (F3.6). Gates: pirâmide (**124 testes**, cobertura `fiscal_engine` **100%**; ruff/mypy limpos); revisao-lgpd (aprovado); revisao-final (revisor + arquiteto aprovados; **drift doc×código corrigido** + reforço de testes).

### Histórico resumido F0.0–F0.3
**F0.0** devcontainer validado (db/redis/minio/app/worker healthy). **F0.1** fundação (ADRs 0001–0007, contrato API, data-model, backlog). **F0.2** reorg monorepo (`frontend/` + `backend/` skeleton). **F0.3** remoção de mocks/identidade AI Studio + specs legado marcados (Vitest 4/4).

## 🧭 Decisões travadas (ADRs em `docs/adr/`)
- Multitenancy = schema compartilhado + `organization_id` + **RLS FORCE** via GUC `app.current_org`; role de app sem BYPASSRLS (0001).
- Auth própria `fastapi-users` + JWT access/refresh + **argon2**; `users` global + `memberships` (RBAC owner/admin/membro); **sem Supabase** (0002).
- **Token org-scoped** (claim `org_id` via select-org) alimenta o RLS (0006).
- API `/api/v1`, erros **RFC 9457**, paginação **keyset**, `Idempotency-Key` em POSTs custosos (0003).
- PK **UUID v7** (gerada na app); dinheiro em `numeric` (0007).
- Monorepo **`backend/` + `frontend/`**; `fiscal_engine` puro com fronteira por import-linter (0004).
- **Layout/cwd do backend (0008):** `backend/` é PASTA do monorepo, NÃO pacote Python. Pacotes top-level vivem DENTRO de `backend/`: `app/` (F1.0), `fiscal_engine/` (F0.7), `workers/` (F1.x). cwd canônico = `/workspace/backend`. Worker = `python -m dramatiq app.tasks`. Import-linter referencia `fiscal_engine`/`app`. **Adendo F0.7a:** estratégia de cobertura por pacote.
- **Modelo de impacto RTC (0009 — NOVO na F0.7a):** direção econômica = único driver; CFOP só exclui ({7,59,69,515,615} → NEUTRAL); `RtcImpact`={CREDIT,DEBIT,NEUTRAL}; INCONFORMIDADE/regime/provedor de alíquotas → F0.7b. Devolução tratada por direção+destaque do próprio documento (sem inverter sinal).
- **Apuração + conformidade (0010 — NOVO na F0.7b):** saldo IBS e CBS **SEPARADOS** (agregado só exibição, nunca liquidação); índices §6.2 (base `v_bc`, divisão-zero→None, com sinal); conformidade por presença de destaque (precedência data→reason→regime; MEI conservador→NAO_AVALIADO); `TaxRegime`+=SIMPLES_EXCESSO; CT-e por nível-documento; `apurar` puro (caller deduplica/seleciona período); `TaxRateProvider` diferido (F3.6).
- Fila = **Dramatiq + Redis** atrás de porta `TaskQueue` portável p/ SQS (0005).
- Nome do produto: **"Simples Apuração RTC"**.

## ❓ Decisões pendentes (confirmar na fatia que precisar)
- Postgres gerenciado não-Supabase (Neon/Aurora/Cloud SQL) — F4/FinOps.
- Provedor de e-mail (verificação/convite/reset) — F1.3.
- Stripe vs gateway BR — F3.
- Retenção do XML bruto + cifragem de CPF + base legal LGPD — F1.x/F2 (com `oficial-lgpd`).
- **Privacidade/fork do repo (público hoje)** — alinhar com o arquiteto antes de privar/mover; até lá NÃO empurrar.

## 🧹 Dívidas técnicas / pendências de código
**Novas da F0.7a (motor fiscal):**
- **Gap `tpNF` no data-model:** F1.5 precisa de `tpNF` (o `purpose`/finNFe **já existe**) p/ calcular a **Direction econômica** em entradas auto-emitidas (devolução CFOP 1.2xx, importação 3.1xx); sem ele, a inferência degrada p/ UNKNOWN→NEUTRAL (seguro). Ver ADR 0009.
- **Cobertura por pacote (F1.0):** gate hoje global no `addopts` (`--cov=fiscal_engine --cov-fail-under=95`) — falha em execução PARCIAL do pytest e não medirá `app`/`workers`. Migrar p/ passos por pacote (CI roda a suíte completa).
- **`FiscalDocument` sem consumidor:** definido mas ainda não usado por `classify_*` (scaffolding p/ F0.7b/F1.5); alinhar `v_bc` (item) vs `v_bc_ibscbs` (doc) quando consumido.
- **Pendências SME (P1–P5)** em `docs/regras-negocio-fiscais.md`: P1 devolução (LC 214/2025), P2 transferências 5.15x/6.15x (pós-regulamentação → eventual remoção de `515`/`615` do conjunto excluído), P3 MEI, P4 FOB/CIF no CT-e, P5 exportação 7.xxx na conformidade.
- **LGPD downstream:** `access_key` embute CNPJ (identificador indireto) e `description` é texto livre → proteger na persistência/transporte/logs; nunca enviar bruto ao Gemini (F1.5/F1.6/F1.8).

**Novas da F0.7b (apuração/conformidade):**
- **Migration de data-model (engenheiro-dados, futura):** `apuracoes` += `creditos_ibs/cbs`, `debitos_ibs/cbs`, `saldo_ibs/cbs`, `idx_saldo_saidas_ibs/cbs`, `base_entradas/saidas`, contagens de conformidade; `fiscal_document_items` += `conformity`/`conformity_reason`; estrutura da lista de inconformidades. Agregados são derivados, **nunca liquidação**. Ver `data-model.md §7`.
- **Derivar enum PG do `StrEnum` do engine** (fonte única) p/ evitar drift doc×código (lição da F0.7b).
- **`InconformidadeRef.access_key`** (id indireto): na persistência preferir FK a `fiscal_documents.id`; se materializar, RLS+cripto+caminho de erasure (F1.6).
- **Pendências SME novas:** base do índice `v_bc` vs `gross_value`; sinal vs `|Saldo|`; `CRT=2`→SIMPLES_EXCESSO; export `7.2xx` (devolução) CONFORME vs NAO_COMERCIAL; arredondamento HALF_UP; confirmar separação IBS/CBS na LC 214/2025.

**Novas da F0.5 (registradas em tooling frontend):**
- **F1.9 (limpeza do legado frontend):** deletar `legacyOverrides` do `eslint.config.js`, promover `warn`→`error`, remover excludes de DIRETÓRIO do `vite.config.ts` e verificar ≥70% em `src/**`.

**Da F0.4/F0.6 (CI):**
- **CI (F0.6):** `npm ci --prefix frontend` antes do pre-commit; decidir `tsc --noEmit` no pre-commit vs só CI; trocar excludes de cobertura por arquivos específicos legados; materializar import-linter (fronteira do engine, referenciando `fiscal_engine`/`app`); `working-directory: backend` nos jobs; `pip install -e` antes de pre-commit/ruff/mypy.

**Herdadas (frontend/IA — F1.x):**
- `frontend/server.ts` legado (Express + proxy Gemini em `POST /api/analyze`). Migrar p/ backend FastAPI sob controles LGPD — **F1.8/F1.9/F1.10**.
- `@google/genai` em `frontend/package.json` (só no `server.ts` legado) — remover/realocar na **F1.9/F1.10**.
- **Lógica fiscal ainda no cliente** (`App.tsx`/`XmlUploader.tsx`) — ERRADA (CFOP por prefixo, alíquotas hardcoded, `Math.max(0)`); substituir pelo motor Python — **F1.9** (não portar o legado).
- `COMPILADO_EXEMPLOS` (DEMO em `XmlUploader.tsx`) → substituir por amostras via API na **F1.9**; bug `emit_name`/`dest_name` vs `emitente`/`destinatario`.
- `frontend/metadata.json` é artefato do AI Studio; considerar remover em higiene futura.

## ▶️ PRÓXIMOS PASSOS (uma fatia por vez, pelos gates)
Fluxo por fatia: `/iniciar-fatia` → especialista implementa → `/piramide-de-testes` → `/revisao-lgpd` (se tocar dados) → `/revisao-final` (revisor-codigo + arquiteto-lider) → `/portao-de-commit` (PARA p/ aprovação). Cobertura: motor ≥95%, demais ≥80%, front ≥70%.

**Próxima: F1.0 — Scaffold FastAPI** · dono **engenheiro-backend** · M  _(ou F0.6 CI quando o push for liberado)_
   - App em camadas (routers→services→repositories; `core/config` por env), `/health`, OpenAPI, erros RFC 9457 (ADR 0003), CORS, logging estruturado. Cria `backend/app/`.
   - Ao introduzir `app`: migrar o gate de cobertura para **medição por pacote** (`fiscal_engine`≥95, `app`≥80) — hoje o `--cov` é global (ver dívidas da F0.7a).
   - DoD: app sobe no container; `/health` ok; OpenAPI gerado; handler de erro testado.

**Em paralelo / quando der:** **F0.6 (CI)** assim que o push for liberado (repo público hoje). Depois **F1.1** dados+Alembic+RLS; **F1.5** parsers XML anti-XXE **+ Direction econômica via `tpNF`** (adicionar `tpNF` ao data-model) — consome o motor F0.7; **F1.6** tabelas fiscais (materializa os gaps de `data-model.md §7`); **F1.7** ingestão+apuração; **F1.8** IA Gemini server-side; **F1.9** frontend na API. Backlog completo em `docs/backlog-fatias.md`.

## 📌 Fontes de verdade
`CLAUDE.md` (regras) · `docs/backlog-fatias.md` · `docs/data-model.md` · `docs/api/contrato-api-v1.md` · `docs/adr/*` (0001–0010) · `docs/regras-negocio-fiscais.md` (catálogo de regras fiscais p/ validação SME) · `docs/devcontainer-assessment.md`. Specs em `ArquivosProjeto/*.md` têm partes **LEGADO** (Next.js/Supabase/cálculo no browser); a verdade fiscal vigente é a **SPEC_XML_MAPPING_v2** + ADR 0009 + `regras-negocio-fiscais.md`.

---

## 🔁 Prompt de retomada (colar na sessão nova, dentro do container)
```
Retome o projeto "Simples Apuração RTC" como ORQUESTRADOR, rodando DENTRO do devcontainer.
Leia HANDOFF.md e CLAUDE.md antes de tudo. Continue a partir de PRÓXIMOS PASSOS — próxima
fatia: F1.0 (scaffold FastAPI), dono engenheiro-backend — ou F0.6 (CI) quando o push for
liberado. Uma fatia por vez pelos gates (/iniciar-fatia → especialista → /piramide-de-testes
→ /revisao-lgpd se tocar dados → /revisao-final → /portao-de-commit). Regras: só na branch
develop (NUNCA main); não comite/empurre sem minha aprovação; NÃO empurre enquanto o repo for
público; não use agentes genéricos; rode tudo dentro do devcontainer (tooling backend de
/workspace/backend, ADR 0008). Os tools Grep/Glob podem falhar — use Bash find/grep. Apresente
o mini-plano da F1.0 e siga.
```

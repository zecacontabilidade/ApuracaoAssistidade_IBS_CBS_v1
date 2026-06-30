# Backlog Fatiado — Fases 0 → 4

> Fatiamento do roadmap (diagnóstico técnico §6) em unidades coesas e pequenas, cada uma
> com **dono (especialista)**, dependências, Definition of Done (DoD) resumido, foco de
> teste e flags de gate. Ordenado por dependência. **Fase 0 e Fase 1 detalhadas**;
> **Fases 2–4 em granularidade grossa**.
>
> **Legenda — tamanho:** P = cabe folgado no contexto; M = uma sessão; G = fatiar mais se
> apertar (split sugerido indicado). **Gates:** 🔒LGPD = passa por `revisao-lgpd`;
> 💰AWS = passa por `guarda-custos-aws`. Toda fatia de código encerra com
> `revisao-final` (revisor-codigo + arquiteto-lider) e commit **preparado, não feito**.
>
> **Donos** (nomes exatos do roster): `arquiteto-lider`, `engenheiro-backend`,
> `engenheiro-dados`, `especialista-auth-seguranca`, `engenheiro-motor-fiscal`,
> `engenheiro-frontend`, `qa-tester`, `devops-finops`, `oficial-lgpd`, `revisor-codigo`,
> `documentador`, `explorador`.

## Reconciliações de planejamento (decisões)

1. **RLS/organização puxados para a Fase 1.** O diagnóstico coloca multi-tenant na Fase
   2, mas CLAUDE.md exige "RLS desde o início". Como a autenticação já cria
   `organization` + `membership owner`, modelamos `organizations/users/memberships` **com
   RLS já na Fase 1** (F1.1). A "Fase 2" concentra os **recursos de tenant** (carteira de
   clientes, histórico, lotes assíncronos), não a introdução do conceito.
2. **Motor fiscal em duas fatias por fase.** Fase 0 entrega o **motor de apuração puro**
   sobre objetos de domínio já parseados (F0.7); Fase 1 entrega os **parsers lxml** que
   alimentam o motor (F1.5) — exatamente o split do diagnóstico ("extrair cálculo" na F0,
   "migrar cálculo e parsing" na F1).
3. **Specs antigos são legado.** SPEC_ARCHITECTURE_v3 / PRD_v3 / ROADMAP descrevem
   Next.js + Supabase + client-side; a stack vigente (CLAUDE.md + diagnóstico) os
   substitui. O `documentador` marca os antigos como legado nas fatias de higiene (F0.3).

---

## FASE 0 — Higiene e fundação (detalhada)

| ID | Título | Dono | Escopo curto | Depende | DoD resumido | Foco de teste | Gates | Tam. |
|---|---|---|---|---|---|---|---|---|
| **F0.0** | Validar/ajustar devcontainer | `devops-finops` | Adicionar MinIO + worker + healthchecks + `depends_on: service_healthy`; `backend/.env.example`/`frontend/.env.example`; forwardPorts 9000/9001; validar Playwright. (Ver `docs/devcontainer-assessment.md`.) | — | `docker compose` sobe app/db/redis/worker/minio **saudáveis**; post-create roda limpo; tudo **dentro do container**. | Smoke: subir serviços, `pg_isready`, `redis-cli ping`, bucket MinIO criado. | 💰AWS | P |
| **F0.1** | Design da fundação *(concluída)* | `arquiteto-lider` | Contrato API v1, data-model, backlog, ADRs 0001–0007, devcontainer-assessment. | — | Docs em `docs/` revisados; decisões e questões abertas registradas. | n/a (design) | — | M |
| **F0.2** | Higiene do repo + reorg `backend/`+`frontend/` | `devops-finops` (+`documentador`) | `git mv` do SPA atual p/ `frontend/`; skeleton `backend/`; renomear projeto (sai `react-example`); substituir `.env.example` antigo; `.gitignore`; README real inicial. (ADR 0004) | F0.0, F0.1 | Estrutura nova compila/serve no container; sem `name: react-example`; README reflete a realidade. | Smoke build do front no container. | — | M |
| **F0.3** *(concluída)* | Remover mocks + identidade de produto | `engenheiro-frontend` (+`documentador`) | Remover CNPJ/empresa fictícios, dados fixos, README do AI Studio, commit "merda" como referência; reescrever PRD/README p/ refletir o produto real; marcar specs antigos como legado. | F0.2 | Zero dados mockados; docs alinhadas; specs antigos sinalizados. | Vitest: telas sem constantes mockadas. | 🔒LGPD (sem dado real) | P |
| **F0.4** | Tooling de qualidade backend | `devops-finops` (+`engenheiro-backend`) | `pyproject`, Ruff (lint+format), mypy/pyright, pytest+coverage, pre-commit. Gates de cobertura (motor ≥95%, demais ≥80%). | F0.2 | `ruff`/type-check/pytest rodam no container; thresholds configurados. | Pipeline local verde (sem testes ainda). | — | P |
| **F0.5** *(concluída)* | Tooling de qualidade frontend | `engenheiro-frontend` | ESLint, Prettier, `tsc` strict, Vitest+coverage (≥70%). Opção B: strict by default, legacy warns via override. | F0.2 | lint/type/test rodam no container; Vitest exemplo verde; threshold ≥70% configurado (dormente). | Vitest exemplo verde; pipeline lint/format/type/test. | — | P |
| **F0.6** | CI (GitHub Actions) | `devops-finops` | Pipeline lint+type+test+build (backend e frontend), cache, import-linter (fronteira do engine), gates de cobertura. Deploy só após verde. | F0.4, F0.5 | CI verde em PR; bloqueia merge com teste vermelho/cobertura baixa. | O próprio pipeline. | 💰AWS (minutos CI) | M |
| **F0.7** | Motor de apuração **puro** (domínio + regras + cálculo) | `engenheiro-motor-fiscal` | Tipos de domínio (`FiscalDocument`, `FiscalItem`, `RtcImpact`, `Apuracao`); regra de impacto (INBOUND→CREDIT / OUTBOUND→DEBIT / CFOP excluído→NEUTRAL — SPEC_XML_MAPPING_v2); cálculo de créditos/débitos/saldo/índices e conformidade (SPEC_BUSINESS_RULES §5–6); **porta de provedor de alíquotas** (sem taxas hardcoded). Sem IO/FastAPI/DB. | F0.4 | Engine isolado importável; ≥95% cobertura; base normativa em comentários. | **Unit pytest** com fixtures **sintéticas** (regimes RPA/SN/MEI, sem IBS/CBS, bordas). | 🔒LGPD (só dados sintéticos) | G (split: F0.7a domínio+regra de impacto; F0.7b apuração+índices+conformidade) |

## FASE 1 — Backend + Banco + Auth (detalhada)

| ID | Título | Dono | Escopo curto | Depende | DoD resumido | Foco de teste | Gates | Tam. |
|---|---|---|---|---|---|---|---|---|
| **F1.0** | Scaffold FastAPI (camadas + config) | `engenheiro-backend` | App em camadas (routers finos → services → repositories; `core/config` por env), `/health`, OpenAPI, handler de erros Problem Details (ADR 0003), CORS, logging estruturado, `requirements.txt`. | F0.6, F0.1 | App sobe no container; `/health` ok; OpenAPI gerado; erros no formato padrão. | Integração: `/health`; unit: handler de erro. | 💰AWS | M |
| **F1.1** | Dados núcleo + Alembic + base RLS | `engenheiro-dados` | Models + 1ª migration: `organizations`, `users`, `memberships`, `refresh_tokens`; role de app sem BYPASSRLS; `ENABLE/FORCE RLS`; GUC `app.current_org`; helper de sessão. (ADR 0001/0006/0007) | F1.0 | Migration up/down; **teste prova isolamento** em `memberships` (tenant A ≠ B). | **Integração pytest** contra Postgres efêmero (RLS). | 🔒LGPD (e-mail), 💰AWS | G (split: F1.1a tabelas+migration; F1.1b RLS+GUC+provas) |
| **F1.2** | Auth: registro de org + login + JWT | `especialista-auth-seguranca` | `fastapi-users` estendido; registro cria org+owner (1 tx); argon2; access curto + refresh rotativo (cookie httpOnly); `select-org`/token exchange org-scoped. (ADR 0002/0006) | F1.1 | Fluxos de registro/login/refresh/select-org; segredos fora do código. | Unit (regras authz) + integração (fluxos). | 🔒LGPD, segurança | G (split: F1.2a registro+login+hash; F1.2b refresh+select-org) |
| **F1.3** | Auth: verificação de e-mail, reset, convites | `especialista-auth-seguranca` | Verificação de e-mail, reset de senha, convite de membro (cria membership c/ papel); provider de e-mail abstraído (console no dev). | F1.2 | Fluxos completos; tokens com hash+expiração; respostas neutras. | Integração dos fluxos; unit dos tokens. | 🔒LGPD | M |
| **F1.4** | RBAC + GUC de RLS por request | `especialista-auth-seguranca` (+`engenheiro-backend`) | Dependency que autentica, revalida membership, seta `SET LOCAL app.current_org`, exige papel por rota (owner/admin/membro). | F1.2, F1.1 | Acesso cross-tenant negado **via API**; papéis aplicados. | **Integração**: 403 cross-tenant; matriz de papéis. | segurança | M |
| **F1.5** | Parsers XML em Python (lxml, anti-XXE) | `engenheiro-motor-fiscal` | Port dos 4 parsers (NF-e/NFC-e/CT-e/NFS-e Nacional) p/ lxml com **entidades externas desabilitadas**; DocumentDetector; Factory; XML→domínio (alimenta F0.7). (SPEC_XML_MAPPING_v2) | F0.7 | Parse correto das fixtures; XXE bloqueado; UNKNOWN p/ ABRASF antigo. | **Unit pytest** ≥95% com fixtures sintéticas; teste anti-XXE. | 🔒LGPD, segurança (XXE) | G (split: F1.5a NF-e/NFC-e; F1.5b CT-e; F1.5c NFS-e Nacional) |
| **F1.6** | Tabelas fiscais + RLS + índices | `engenheiro-dados` | Models+migration+RLS+índices p/ `clients`, `fiscal_documents`(+`items`), `apuracoes`, `dossiers`, `aliquotas`. Ponteiro `raw_xml_uri`. (data-model §3–4) | F1.1 | Migrations ok; RLS+índices conforme doc; provas de isolamento nas novas tabelas. | Integração RLS + checagem de índices. | 🔒LGPD (PII fiscal), 💰AWS | G |
| **F1.7** | Ingestão síncrona + apuração (single/pequeno) | `engenheiro-backend` | `POST /ingestions` (1 XML/zip pequeno) → parse (F1.5) → grava em object storage + `fiscal_documents` → roda apuração (F0.7) → `POST /apuracoes`. `Idempotency-Key`. (contrato §7–8) | F1.5, F1.6, F1.4 | Fluxo upload→apuração persistido e isolado por tenant; idempotência. | **Integração** ponta-a-ponta (sem fila); unit de mapeamento. | 🔒LGPD, 💰AWS (storage) | G (split: F1.7a storage+persistência de docs; F1.7b cálculo+endpoint de apuração) |
| **F1.8** | Camada de IA (Gemini) no servidor | `engenheiro-backend` (+`oficial-lgpd`) | Serviço de IA com **provedor abstraído**; builder de `AiContext` (só agregados anonimizados — guardião de privacidade); `POST /dossiers`; persiste modelo/tokens/custo; `ai_enabled` por org. (ADR/contrato §9) | F1.6, F0.7 | Dossiê gerado a partir de agregados; **teste prova ausência de CNPJ/nome** no contexto; IA desligável. | Unit (privacidade do contexto) + integração (provider fake). | 🔒LGPD (sub-processador Gemini/DPA), 💰AWS (tokens) | G |
| **F1.9** | Frontend: cliente de API + login + consumo | `engenheiro-frontend` | React Router, TanStack Query, cliente de API, telas login/registro/seleção de org; migrar upload→apuração→dossiê p/ a API; **remover motor do cliente**; Recharts no painel básico. | F1.2, F1.7, F1.8 | App autenticado consome a API; sem regra fiscal no front; loading/erro/empty tratados. | **Vitest** (componentes/hooks) + e2e leve de login (com `qa-tester`). | 🔒LGPD (texto de consentimento mínimo) | G (split: F1.9a auth+cliente API; F1.9b views de apuração; F1.9c view de dossiê) |
| **F1.10** | Migração de segredos + config | `especialista-auth-seguranca` (+`devops-finops`) | `GEMINI_API_KEY` server-only, `JWT_SECRET`, credenciais DB/S3 via env/secret manager; remover qualquer segredo do cliente. | F1.0 | Segredos fora do código/cliente; doc de variáveis. | Teste: ausência de segredo no bundle do front. | segurança, 💰AWS | P |

> **Ordem sugerida na Fase 1:** F1.0 → F1.1 → (F1.2 → F1.3 → F1.4) ∥ (F1.5 após F0.7) →
> F1.6 → F1.7 → F1.8 → F1.9 → F1.10. F1.5 pode correr em paralelo ao bloco de auth.

---

## FASE 2 — Multi-tenant + persistência (alto nível)

| ID | Título | Dono | Notas | Gates |
|---|---|---|---|---|
| F2.0 | Carteira de clientes (CRUD CNPJ) | `engenheiro-backend` + `engenheiro-dados` | Contrato §6; validação de CNPJ; único por org. | 🔒LGPD |
| F2.1 | Histórico de apurações/dossiês + comparação entre períodos | `engenheiro-backend` + `engenheiro-frontend` | Listagens keyset; comparativo período a período. | 🔒LGPD |
| F2.2 | Lotes assíncronos (fila + storage) | `engenheiro-backend` + `devops-finops` + `engenheiro-motor-fiscal` | **Porta `TaskQueue`** + Dramatiq/Redis (ADR 0005); upload de milhares de XML com status/progresso; XML em S3/MinIO. | 🔒LGPD, 💰AWS |
| F2.3 | Hardening de RLS + provas ampliadas | `engenheiro-dados` + `qa-tester` | Isolamento provado em **todas** as tabelas de negócio. | segurança |
| F2.4 | Gestão de membros/papéis na UI | `especialista-auth-seguranca` + `engenheiro-frontend` | Convites/papéis no front; revogação imediata. | 🔒LGPD |
| F2.5 | Auditoria (`audit_logs`) nas ações | `engenheiro-backend` + `oficial-lgpd` | Trilha append-only; contrato §12. | 🔒LGPD |
| F2.6 | ROPA/DPIA + retenção + erasure | `oficial-lgpd` | Registro de tratamento; política de retenção; caminho de hard-delete/anonimização (tensão do soft-delete). | 🔒LGPD |

## FASE 3 — Comercialização (alto nível)

| ID | Título | Dono | Notas | Gates |
|---|---|---|---|---|
| F3.0 | Planos + subscriptions + usage metering | `engenheiro-backend` + `engenheiro-dados` | Catálogo + medição (docs/dossiês/tokens). | 💰AWS |
| F3.1 | Stripe (checkout/webhooks/paywall/limites) | `engenheiro-backend` + `devops-finops` | Contrato §11; verificação de webhook; `plan_limit_exceeded`. | 🔒LGPD, 💰AWS |
| F3.2 | LGPD: consentimento, política, direitos do titular | `oficial-lgpd` + `engenheiro-backend` + `engenheiro-frontend` | Export/delete do titular; banner/política; base legal. | 🔒LGPD |
| F3.3 | Dashboard com gráficos reais (Recharts) | `engenheiro-frontend` | KPIs e posição fiscal por cliente/período. | — |
| F3.4 | Exportações no servidor (PDF/Excel) auditáveis | `engenheiro-backend` | Consistentes e reproduzíveis; contrato §8–9. | 🔒LGPD |
| F3.5 | Onboarding guiado | `engenheiro-frontend` | Primeiro uso (criar org/cliente/primeira apuração). | — |
| F3.6 | Alíquotas administráveis por vigência + seed 2026–2033 | `engenheiro-backend` + `engenheiro-dados` + `engenheiro-motor-fiscal` | Admin de `aliquotas`; seed da transição; provedor consumido pelo engine. | — |

## FASE 4 — Escala e robustez (alto nível / contínuo)

| ID | Título | Dono | Notas | Gates |
|---|---|---|---|---|
| F4.0 | Observabilidade (logs/métricas/Sentry/OTel) | `devops-finops` | Operar com confiança. | 💰AWS |
| F4.1 | E2E Playwright dos fluxos críticos | `qa-tester` | Login, upload→apuração, isolamento multi-tenant, consentimento. | — |
| F4.2 | Performance de lotes (até 50k XML) | `engenheiro-motor-fiscal` + `engenheiro-dados` + `devops-finops` | Tuning de workers/índices; CPU-bound (ADR 0005). | 💰AWS |
| F4.3 | Revisão de segurança | `especialista-auth-seguranca` | Rate limit, headers, CORS, rotação de segredos, pen-test interno. | segurança |
| F4.4 | API pública read-only (ERPs) | `engenheiro-backend` + `arquiteto-lider` | Chaves/escopos; versionada (ADR 0003). | 🔒LGPD, 💰AWS |
| F4.5 | SSO enterprise (Keycloak/OIDC) | `especialista-auth-seguranca` | Sem reintroduzir SaaS de auth (ADR 0002). | segurança |
| F4.6 | Deploy AWS custo-otimizado + IaC | `devops-finops` | Fargate/Lambda, Aurora Serverless v2/RDS right-sized (não-Supabase), S3 lifecycle, SQS, CloudFront; tagging/orçamento/alertas. | 💰AWS |

---

## Caminho crítico (resumo)

`F0.0 → F0.1 → F0.2 → (F0.4,F0.5) → F0.6 → F0.7` ⟶
`F1.0 → F1.1 → F1.2 → F1.4 → F1.6 → F1.7 → F1.8 → F1.9`, com **F1.5** dependente de
**F0.7** e paralelizável ao bloco de auth (F1.2–F1.4). Cada fatia só é "pronta" com a
pirâmide de testes nas metas (motor ≥95%, demais ≥80%, front ≥70%), gates aplicáveis
aprovados, docs/ADRs atualizados e **commit preparado aguardando aprovação humana**.

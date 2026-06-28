# Contrato da API v1 — Simples Apuração RTC

> Esboço de contrato (estilo OpenAPI em tabelas). Detalha o ADR 0003 (estilo/
> versionamento), ADR 0002 (auth) e ADR 0006 (org-scoped token). Os schemas reais serão
> gerados pelo FastAPI/Pydantic v2 quando os endpoints forem implementados (Fase 1+).
> Status: **design** (sem código nesta fatia).

## 1. Convenções

- **Base path:** `/api/v1`. Mudança incompatível → `/api/v2` (ADR 0003).
- **Auth:** `Authorization: Bearer <access_jwt>`. O **escopo de organização** vem do
  claim `org_id` do token (ADR 0006); rotas de negócio são planas (sem `org_id` no path).
- **Conteúdo:** `application/json` (UTF-8). Datas ISO-8601 UTC. Dinheiro como **string
  decimal** (ex.: `"123.45"`) ou centavos inteiros — nunca float. Campos `snake_case`.
- **Erros:** **RFC 9457** `application/problem+json`:
  `{ "type", "title", "status", "detail", "instance", "code", "errors": [ { "field", "message" } ] }`.
  Nunca vaza dados de outro tenant nem stack trace.
- **Paginação:** keyset para coleções grandes — `?limit=&cursor=`; envelope
  `{ "data": [...], "page": { "next_cursor", "has_more" } }`. Coleções pequenas: offset
  (`?page=&page_size=`).
- **Idempotência:** header `Idempotency-Key` **obrigatório** em POST que criam recursos
  custosos, disparam jobs de lote ou tocam cobrança (marcado com **[idem]** abaixo).
- **RBAC:** papéis `owner` > `admin` > `membro` (coluna "Papel"). `público` = sem auth;
  `qualquer` = qualquer membership válida da org do token.
- **Rate limiting:** por IP nas rotas de auth; por organização nas demais. Excesso → 429
  com `Retry-After`.
- **Status codes:** 200/201 sucesso; 202 job aceito (assíncrono); 204 sem corpo; 400
  validação; 401 não autenticado; 403 sem permissão; 404 inexistente/fora do tenant; 409
  conflito (ex.: dedupe/idempotência); 422 entidade inválida; 429 rate limit.

## 2. Erros padrão (catálogo `code`)

| `code` | HTTP | Quando |
|---|---|---|
| `validation_error` | 422 | Payload inválido (lista em `errors[]`). |
| `unauthorized` | 401 | Token ausente/inválido/expirado. |
| `forbidden` | 403 | Papel insuficiente / fora da organização. |
| `not_found` | 404 | Recurso inexistente ou de outro tenant (indistinguível por design). |
| `conflict` | 409 | Violação de unicidade / chave de idempotência reusada com payload diferente. |
| `rate_limited` | 429 | Limite excedido. |
| `plan_limit_exceeded` | 403 | Limite do plano atingido (docs/dossiês/tokens). |
| `ai_disabled` | 403 | IA desligada para a organização. |

---

## 3. Auth e identidade (`/api/v1/auth`)

> Tabelas: `users`, `memberships`, `refresh_tokens`, `invitations`, `organizations`.
> Rotas públicas têm rate limiting estrito. Refresh token em cookie httpOnly (ADR 0002).

| Método | Rota | Papel | Request (resumo) | Response (resumo) |
|---|---|---|---|---|
| POST | `/auth/register` **[idem]** | público | `{ org_name, full_name, email, password }` | 201 `{ user, organization }`; cria org + membership `owner` (1 transação); dispara verificação de e-mail. |
| POST | `/auth/login` | público | `{ email, password }` | 200 `{ session_token, memberships: [{ organization_id, name, role }] }` + cookie refresh. Não org-scoped ainda. |
| POST | `/auth/select-org` | público (com session_token) | `{ organization_id }` | 200 `{ access_token, expires_in, role }` — **access token org-scoped** (ADR 0006). |
| POST | `/auth/refresh` | público (cookie) | — (cookie refresh) | 200 `{ access_token, expires_in }`; rotaciona refresh; detecta reuso. |
| POST | `/auth/logout` | qualquer | — | 204; revoga refresh atual. |
| POST | `/auth/verify-email` | público | `{ token }` | 204; marca `email_verified_at`. |
| POST | `/auth/verify-email/resend` | qualquer | — | 202. |
| POST | `/auth/password/forgot` | público | `{ email }` | 202 (resposta neutra, não revela existência). |
| POST | `/auth/password/reset` | público | `{ token, new_password }` | 204; revoga refresh tokens do user. |
| GET | `/auth/me` | qualquer | — | 200 `{ user, active_org, role, memberships }`. |

## 4. Organizações (`/api/v1/organizations`)

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| GET | `/organizations/current` | qualquer | — | 200 org ativa (do token) + plano/status. |
| PATCH | `/organizations/current` | owner/admin | `{ name?, settings? }` | 200 org atualizada. |
| GET | `/organizations/current/settings/ai` | owner/admin | — | 200 `{ ai_enabled, model_default }`. |
| PUT | `/organizations/current/settings/ai` | owner/admin | `{ ai_enabled, model_default }` | 200; liga/desliga IA por organização (LGPD/custo). |
| DELETE | `/organizations/current` | owner | `{ confirm }` | 202; inicia exclusão/anonimização (LGPD, assíncrono). |

## 5. Membros e convites (`/api/v1/memberships`, `/invitations`)

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| GET | `/memberships` | qualquer | `?limit&cursor` | 200 lista de membros da org ativa. |
| PATCH | `/memberships/{id}` | owner/admin | `{ role }` | 200; muda papel (admin não promove a owner). |
| DELETE | `/memberships/{id}` | owner/admin | — | 204; remove membro (revoga acesso imediato). |
| POST | `/invitations` **[idem]** | owner/admin | `{ email, role }` | 201 convite; envia e-mail com token. |
| GET | `/invitations` | owner/admin | `?status` | 200 convites pendentes. |
| DELETE | `/invitations/{id}` | owner/admin | — | 204; cancela convite. |
| POST | `/invitations/accept` | público (com session_token) | `{ token }` | 200; cria membership para o user logado. |

## 6. Carteira de clientes (`/api/v1/clients`) — Fase 2

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| GET | `/clients` | qualquer | `?limit&cursor&q` | 200 lista de CNPJs da carteira (org ativa). |
| POST | `/clients` **[idem]** | owner/admin | `{ cnpj, razao_social, uf?, regime? }` | 201; único por `(org, cnpj)`. |
| GET | `/clients/{id}` | qualquer | — | 200 detalhe. |
| PATCH | `/clients/{id}` | owner/admin | `{ razao_social?, uf?, regime? }` | 200. |
| DELETE | `/clients/{id}` | owner/admin | — | 204 (soft-delete). |

## 7. Documentos fiscais e ingestão (`/api/v1/fiscal-documents`, `/ingestions`)

> XML bruto vai para object storage; o registro guarda `raw_xml_uri`. Parsing com lxml
> anti-XXE (engine). Lotes grandes são assíncronos (Fase 2); single/pequeno pode ser
> síncrono (Fase 1).

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| POST | `/ingestions` **[idem]** | membro+ | multipart: `client_id` + arquivos `.xml`/`.zip` | 202 `{ ingestion_id, status: "queued" }` (lote) **ou** 201 resultado (single/pequeno, Fase 1). |
| GET | `/ingestions/{id}` | qualquer | — | 200 `{ status, processed, total, errors[] }` (progresso). |
| GET | `/fiscal-documents` | qualquer | `?client_id&period_start&period_end&document_type&direction&cfop&limit&cursor` | 200 lista (keyset por `issue_date,id`). |
| GET | `/fiscal-documents/{id}` | qualquer | — | 200 cabeçalho + itens + impactos RTC. |
| GET | `/fiscal-documents/{id}/raw` | owner/admin | — | 200 URL pré-assinada do XML bruto (auditada; LGPD). |
| DELETE | `/fiscal-documents/{id}` | owner/admin | — | 204 (soft-delete). |

## 8. Apurações (`/api/v1/apuracoes`)

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| POST | `/apuracoes` **[idem]** | membro+ | `{ client_id, period_start, period_end, granularity }` | 201 apuração (créditos, débitos, saldo, índices) calculada pelo engine sobre os docs do período. |
| GET | `/apuracoes` | qualquer | `?client_id&limit&cursor` | 200 histórico. |
| GET | `/apuracoes/{id}` | qualquer | — | 200 detalhe + agrupamentos (por CFOP/tipo). |
| GET | `/apuracoes/{id}/inconformidades` | qualquer | — | 200 lista de inconformidades (RPA sem IBS/CBS em 2026+, etc.). |
| POST | `/apuracoes/{id}/close` | owner/admin | — | 200; `status=CLOSED` (congela snapshot). |
| GET | `/apuracoes/{id}/export` | qualquer | `?format=pdf\|xlsx` | 200 arquivo (export no servidor, Fase 3) ou 202 (assíncrono). |

## 9. Dossiês de IA (`/api/v1/dossiers`)

> Só envia **agregados anonimizados** ao Gemini (guardião de privacidade). Respeita
> `ai_enabled` da org e limites do plano. Registra modelo/tokens/custo.

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| POST | `/dossiers` **[idem]** | membro+ | `{ apuracao_id, model? }` | 202 `{ dossier_id, status }` (geração) — 403 `ai_disabled`/`plan_limit_exceeded` se aplicável. |
| GET | `/dossiers/{id}` | qualquer | — | 200 `{ status, content_md, model, tokens, cost_cents }`. |
| GET | `/dossiers` | qualquer | `?client_id&apuracao_id&limit&cursor` | 200 histórico. |
| GET | `/dossiers/{id}/export` | qualquer | `?format=html\|pdf` | 200 arquivo (logo/nome da org no cabeçalho). |

## 10. Alíquotas (`/api/v1/aliquotas`) — referência global

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| GET | `/aliquotas` | qualquer | `?tributo&uf&municipio_ibge&date` | 200 alíquotas vigentes na data (transição 2026–2033). |
| POST | `/aliquotas` | **admin-do-sistema** | `{ tributo, escopo, uf?, municipio_ibge?, vigencia_inicio, vigencia_fim, aliquota, fonte }` | 201 (administração; fora do RBAC de tenant). |
| PATCH | `/aliquotas/{id}` | admin-do-sistema | `{ ... }` | 200. |

> `aliquotas` é global (sem `organization_id`); leitura liberada a qualquer membership,
> escrita restrita a administração do produto (não ao RBAC de tenant).

## 11. Billing, planos e uso (`/api/v1/billing`) — Fase 3

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| GET | `/billing/plans` | qualquer | — | 200 catálogo (free/pro/enterprise + limites). |
| GET | `/billing/subscription` | owner/admin | — | 200 assinatura atual + status. |
| POST | `/billing/checkout` **[idem]** | owner | `{ plan_code }` | 200 `{ checkout_url }` (Stripe). |
| POST | `/billing/portal` | owner | — | 200 `{ portal_url }`. |
| POST | `/billing/webhook` | público (assinado Stripe) | evento Stripe | 204; atualiza subscription/usage (verificação de assinatura). |
| GET | `/billing/usage` | owner/admin | `?period` | 200 medição (docs, dossiês, tokens). |

## 12. Auditoria (`/api/v1/audit-logs`) — Fase 2

| Método | Rota | Papel | Request | Response |
|---|---|---|---|---|
| GET | `/audit-logs` | owner/admin | `?actor_user_id&action&resource_type&from&to&limit&cursor` | 200 trilha (append-only) da org ativa. |

## 13. Operação/saúde

| Método | Rota | Papel | Response |
|---|---|---|---|
| GET | `/api/v1/health` | público | 200 `{ status: "ok" }` (liveness). |
| GET | `/api/v1/health/ready` | público | 200/503 readiness (db/redis/storage). |
| GET | `/api/openapi.json`, `/api/docs` | público* | contrato OpenAPI gerado (restringir em prod). |

## 14. Notas de RBAC (resumo)

- **owner:** tudo na org, incluindo exclusão da org e cobrança.
- **admin:** gerencia membros (exceto promover/rebaixar owner), clientes, configurações,
  vê auditoria; não mexe em cobrança crítica (checkout = owner).
- **membro:** opera o produto (ingestão, apuração, dossiê, leitura) dentro do tenant.
- Toda autorização é verificada **no servidor** (ADR 0002); o claim `org_id`+`role` do
  token é revalidado contra `memberships` a cada request (ADR 0006), refletindo remoções
  de acesso imediatamente.

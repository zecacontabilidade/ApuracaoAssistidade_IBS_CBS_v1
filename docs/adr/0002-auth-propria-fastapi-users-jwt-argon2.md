# ADR 0002 — Autenticação própria (fastapi-users + JWT + argon2), sem Supabase

- **Status:** Aceito
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com especialista-auth-seguranca, oficial-lgpd)
- **Relacionados:** 0001 (RLS), 0006 (escopo de tenant no token)

## Contexto

O protótipo e os specs antigos (SPEC_ARCHITECTURE_v3, PRD_v3, ROADMAP) usavam
**Supabase Auth**. A direção definida do projeto (CLAUDE.md, diagnóstico §4.5) é
**autenticação própria, SEM Supabase** — "backend e banco de verdade", com controle
total e sem reintroduzir um SaaS de auth de terceiros. Precisamos de cadastro de
organização, login, verificação de e-mail, reset de senha, convite de membros e RBAC.

## Decisão

Implementar autenticação **própria no FastAPI** com:

- **Biblioteca:** `fastapi-users` (gestão de usuários, fluxos de verificação/reset,
  backends de transporte/estratégia) como base, estendida para o modelo
  multi-organização. Alternativa de menor acoplamento: `Authlib` + código próprio.
- **Hashing de senha:** **argon2** (argon2id) via `passlib`/`argon2-cffi`.
- **Tokens:** **JWT** com par **access (curto, ~15 min) + refresh (rotativo, com
  revogação)**. Access token enviado em `Authorization: Bearer`. Refresh token
  entregue em **cookie httpOnly + Secure + SameSite** para o app web; persistido como
  hash em `refresh_tokens` com rotação (cada uso emite novo e revoga o anterior) e
  detecção de reuso.
- **Modelo:** `users` é **global** (identidade cross-org, e-mail único). O vínculo com
  organizações e o papel (owner/admin/membro) vivem em `memberships` (RBAC). O cadastro
  inicial cria a organização e a membership `owner` numa única transação.
- **RBAC:** autorização verificada **sempre no servidor** por dependency do FastAPI;
  nunca confiar no cliente.
- **Segredos:** chave de assinatura JWT e credenciais fora do código (env no dev,
  secret manager em prod).

SSO/login social fica fora do MVP; se exigido por enterprise, a opção é **Keycloak
self-hosted** (OIDC) — sem reintroduzir SaaS de auth de terceiros (ver Fase 4).

## Alternativas consideradas

- **Supabase Auth:** proibido pela direção do projeto; reintroduz dependência de
  terceiro e fragmenta o controle de dados/RLS (que agora é do nosso Postgres).
- **Authlib puro / código 100% próprio:** mais flexível, porém reimplementa fluxos
  (verificação, reset, hashing) que `fastapi-users` já entrega testados. Fica como
  alternativa caso `fastapi-users` imponha atrito com o modelo multi-org.
- **Sessões server-side (cookie de sessão + store):** simples para web, mas pior para a
  futura API pública (roadmap) e para clientes não-browser; JWT atende ambos.
- **bcrypt:** aceitável, mas argon2id é o padrão recomendado atual para senhas.

## Consequências

- **Positivas:** controle total da identidade, integração natural com RLS (o `org_id`
  do token alimenta a GUC do ADR 0001), pronto para API pública futura.
- **Negativas / cuidados:**
  - Responsabilidade de segurança é nossa: rate limiting em login/registro, lockout,
    rotação/revogação de refresh, verificação de e-mail obrigatória antes de operar
    dados sensíveis — itens do especialista-auth-seguranca.
  - Envio de e-mail (verificação/convite/reset) exige provedor (SES em prod; backend de
    console no dev) — questão aberta para o usuário.
  - Troca de organização ativa exige re-emissão/token exchange (ver ADR 0006).
  - `users` global não é coberta por RLS-por-org: a autorização dela é responsabilidade
    estrita da camada de aplicação.

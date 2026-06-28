# ADR 0006 — Escopo de tenant no token (org-scoped JWT)

- **Status:** Aceito
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com especialista-auth-seguranca, engenheiro-dados)
- **Relacionados:** 0001 (RLS), 0002 (auth), 0003 (API)

## Contexto

Um `user` pode pertencer a **várias organizações** (`memberships`). O isolamento por
RLS (ADR 0001) depende da GUC `app.current_org` ser setada de forma **confiável** a
cada requisição. Precisamos decidir como o servidor sabe qual é a organização ativa de
uma requisição, sem confiar em um valor arbitrário enviado pelo cliente.

## Decisão

O **access token é org-scoped**: carrega o claim **`org_id`** (e `role` daquela
membership). O fluxo:

1. **Login** autentica o `user` e retorna um token de sessão + a **lista de
   memberships** (organizações às quais pertence).
2. O cliente chama **`POST /api/v1/auth/select-org`** (token exchange) informando a
   organização escolhida; o servidor valida a membership e emite um **access token
   org-scoped** (`org_id`, `role`, `user_id`).
3. A cada requisição, o backend valida o JWT, confirma que a membership ainda é válida
   e executa `SET LOCAL app.current_org = org_id` na transação (alimenta o RLS).
4. **Trocar de organização** = repetir o token exchange (novo access token). O refresh
   token permanece atrelado ao `user`.

## Alternativas consideradas

- **Organização no path (`/api/v1/orgs/{org_id}/...`) + checagem de membership por
  requisição:** explícito e RESTful, mas espalha o `org_id` por todas as rotas e
  delega ao cliente carregar o id; o servidor precisa validar membership em todo
  endpoint de qualquer forma. Mantemos as rotas **planas** (escopo implícito pelo
  token), o que casa melhor com a GUC do RLS.
- **Header `X-Org-Id` definido pelo cliente:** rejeitado — confiar em header do cliente
  para isolamento é frágil; exigiria validar membership a cada chamada e abre espaço
  para erro. O claim assinado no token é mais seguro.
- **Token multi-org (sem org fixa) + escolha por request:** reintroduz o problema de
  confiar no cliente para dizer a org; pior para RLS fail-closed.

## Consequências

- **Positivas:** o `org_id` é assinado e confiável; RLS fail-closed natural; rotas
  limpas; autorização (role) viaja no token.
- **Negativas / cuidados:**
  - Trocar de org exige novo token (UX: "trocar organização" re-emite o access token);
    documentar no contrato.
  - Revogação ao remover uma membership: o access token org-scoped é curto, mas o
    backend deve revalidar a membership a cada request (não apenas confiar no claim) para
    refletir remoções imediatamente.
  - Telas que listam "minhas organizações" usam a lista retornada no login, antes do
    escopo.

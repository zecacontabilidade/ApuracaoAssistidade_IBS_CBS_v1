# ADR 0001 — Multitenancy: schema compartilhado + `organization_id` + RLS

- **Status:** Aceito
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com engenheiro-dados, oficial-lgpd)
- **Relacionados:** 0002 (auth), 0006 (escopo de tenant no token), 0007 (UUID v7)

## Contexto

O produto é um SaaS B2B para escritórios de contabilidade (cada escritório = um
tenant) que processa dados fiscais sensíveis de múltiplos clientes (CNPJs). A regra
de ouro do projeto (CLAUDE.md) e o diagnóstico técnico (§4.3) exigem isolamento
estrito entre tenants — "proibido vazar dados entre tenants". É preciso escolher a
estratégia de multitenancy do PostgreSQL 16 já no desenho, antes de qualquer tabela.

Três estratégias clássicas: (a) banco compartilhado + `tenant_id` + Row-Level
Security (RLS); (b) schema por tenant; (c) banco por tenant.

## Decisão

Adotar **schema único compartilhado**, com coluna **`organization_id NOT NULL`** em
toda tabela de negócio e **Row-Level Security (RLS) do PostgreSQL** como mecanismo de
isolamento, ativado desde a primeira migration (não como retrofit).

Mecânica:

1. A aplicação conecta no banco com um **role de aplicação sem privilégio de
   `BYPASSRLS`** e que **não é o owner** das tabelas. As migrations Alembic rodam com
   um role separado (owner/migrador).
2. Toda tabela de negócio recebe `ENABLE ROW LEVEL SECURITY` **e** `FORCE ROW LEVEL
   SECURITY` (para que nem o owner escape da política em conexões da aplicação).
3. Política padrão por tabela:
   `USING (organization_id = current_setting('app.current_org')::uuid)`
   e o mesmo predicado em `WITH CHECK` para INSERT/UPDATE.
4. A cada requisição autenticada, um middleware/depends define a GUC de sessão
   `SET LOCAL app.current_org = '<uuid>'` dentro da transação, a partir do
   `org_id` do token (ver ADR 0006). Sem GUC definida, as políticas não casam e
   nenhuma linha é visível (fail-closed).
5. Tabelas **globais** (sem `organization_id`): `users` (identidade cross-org),
   `aliquotas` (referência normativa), `plans` (catálogo). Estas não têm RLS por
   organização; o acesso é mediado por lógica de aplicação/role.

## Alternativas consideradas

- **Schema por tenant:** isolamento mais forte e migrations por tenant, mas
  complexidade operacional alta (N schemas, fan-out de migrations, conexões) e custo
  crescente. Reservado para futura promoção de clientes enterprise.
- **Banco por tenant:** isolamento máximo, custo/operacional proibitivos para um
  produto que nasce com plano Free. Reservado para exigências contratuais raras.
- **Apenas filtro por `organization_id` na aplicação (sem RLS):** rejeitado — um único
  bug de query (esquecer o `WHERE`) vaza dados entre tenants; viola a regra de ouro.
  RLS é a rede de segurança no nível do banco, independente do ORM.

## Consequências

- **Positivas:** custo baixo, operação simples, isolamento garantido pelo banco
  (defesa em profundidade junto ao filtro da aplicação), caminho aberto para promover
  enterprise a schema dedicado depois.
- **Negativas / cuidados:**
  - Disciplina de conexão: o role de aplicação **nunca** pode ter `BYPASSRLS`; CI deve
    ter teste que prova o isolamento (tenant A não enxerga B) — exigência do
    engenheiro-dados e do qa-tester.
  - Toda nova tabela de negócio precisa, na mesma migration: coluna
    `organization_id`, FK, índice, `ENABLE/FORCE RLS` e política. Vira item de checklist
    da `revisao-final`.
  - GUC `app.current_org` deve ser setada com `SET LOCAL` (escopo de transação) para
    não vazar entre conexões reusadas do pool.
  - `users` global exige cuidado extra de autorização na camada de aplicação (não há
    RLS por org protegendo-a).

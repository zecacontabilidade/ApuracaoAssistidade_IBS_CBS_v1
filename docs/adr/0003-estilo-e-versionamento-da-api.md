# ADR 0003 — Estilo e versionamento da API

- **Status:** Aceito
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com engenheiro-backend)
- **Relacionados:** 0002 (auth), 0006 (org no token); detalhamento em
  `docs/api/contrato-api-v1.md`

## Contexto

O frontend deixa de ser autoridade de cálculo e passa a ser **cliente de uma API**
(diagnóstico §4.1). Há previsão de **API pública (read-only) para ERPs** no roadmap.
Precisamos de convenções estáveis de versionamento, erros, paginação, autenticação e
idempotência antes de escrever endpoints.

## Decisão

- **Estilo:** REST sobre JSON, recursos no plural, contrato **OpenAPI** gerado
  automaticamente pelo FastAPI (Pydantic v2 como fonte dos schemas).
- **Versionamento:** prefixo de **URI `/api/v1`**. Mudanças incompatíveis abrem `/v2`;
  mudanças compatíveis (campos novos opcionais) ficam na v1. SemVer documentado no
  changelog da API.
- **Autenticação:** `Authorization: Bearer <access_jwt>` (ADR 0002). O escopo de tenant
  vem do claim `org_id` do token (ADR 0006), não de header arbitrário do cliente.
- **Erros:** **RFC 9457 Problem Details** (`application/problem+json`) com `type`,
  `title`, `status`, `detail`, `instance` e extensões `code` (string estável) e
  `errors[]` (erros de validação por campo). Mensagens nunca vazam dados de outro
  tenant nem stack traces.
- **Paginação:** **keyset/cursor** para coleções grandes (`fiscal_documents`,
  `audit_logs`) com `?limit=&cursor=`; envelope
  `{ "data": [...], "page": { "next_cursor": "...", "has_more": true } }`. Coleções
  pequenas podem usar offset (`?page=&page_size=`). Ordenação estável por
  `(issue_date, id)` / `(created_at, id)`.
- **Idempotência:** header **`Idempotency-Key`** obrigatório em POST que criam recursos
  custosos, disparam jobs de lote ou tocam cobrança (upload/ingestão, geração de
  apuração e dossiê, billing). A chave + `org_id` + rota é persistida com a resposta por
  uma janela (ex.: 24h) para retornar a mesma resposta em retries.
- **Padrões transversais:** `created_at`/`updated_at` ISO-8601 UTC; valores monetários
  como string decimal ou inteiro de centavos (nunca float binário) para precisão
  fiscal; nomes de campos em `snake_case`; datas de competência fiscal explícitas.
- **Segurança de transporte:** HTTPS obrigatório, CORS restrito às origens conhecidas,
  headers de segurança, rate limiting (por IP em auth, por org na API).

## Alternativas consideradas

- **Versionamento por header (`Accept` media type):** mais "purista" REST, porém menos
  visível/testável e pior DX para a API pública; URI é mais simples para o público-alvo.
- **GraphQL:** flexível para o cliente, mas adiciona complexidade de cache, custo de
  consulta e superfície de segurança; REST+OpenAPI cobre os casos atuais e a integração
  com ERPs.
- **Erros ad-hoc `{error: "..."}`:** rejeitado — Problem Details padroniza e evolui
  melhor, com código estável para o cliente tratar.
- **Apenas paginação por offset:** ruim para tabelas que crescem para milhões de linhas
  (lotes de XML); keyset é estável e performático.

## Consequências

- **Positivas:** contrato autodocumentado (OpenAPI/Swagger), DX previsível, pronto para
  API pública, erros e paginação consistentes entre recursos.
- **Negativas / cuidados:**
  - Idempotência exige store de chaves (Redis/tabela) e disciplina nos handlers.
  - Keyset exige índices compostos coerentes (ver `docs/data-model.md`).
  - Trocar a organização ativa muda o conteúdo das coleções (mesma rota, token
    diferente) — documentar claramente no contrato.

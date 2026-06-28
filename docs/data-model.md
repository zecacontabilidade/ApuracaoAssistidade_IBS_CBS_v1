# Modelo de Dados Núcleo — Simples Apuração RTC

> Valida e detalha o "Modelo de dados (núcleo)" do diagnóstico técnico (§4.4).
> Convenções: PostgreSQL 16; PK **UUID v7** (ADR 0007); multitenancy por
> `organization_id` + **RLS** (ADR 0001); timestamps `timestamptz` UTC; dinheiro como
> `numeric`/inteiro de centavos (nunca float); `snake_case`.
> Status: **design** (não há migrations reais nesta fatia).

## 1. Classificação das tabelas quanto a tenant/RLS

| Categoria | Tabelas | `organization_id`? | RLS por org? |
|---|---|---|---|
| **Global — identidade** | `users`, `refresh_tokens` | Não | Não (autorização na aplicação) |
| **Global — referência/catálogo** | `aliquotas`, `plans` | Não | Não (leitura para todos; escrita admin) |
| **De negócio (tenant)** | `organizations`*, `memberships`, `invitations`, `clients`, `fiscal_documents`, `fiscal_document_items`, `apuracoes`, `dossiers`, `subscriptions`, `usage_records`, `audit_logs` | Sim | **Sim** (`FORCE RLS`) |

\* `organizations` é o próprio tenant: a linha tem `id` = `organization_id`; a política
RLS usa `id = current_setting('app.current_org')::uuid`.

**Postura de RLS (ADR 0001):** todas as tabelas de negócio recebem `ENABLE` + `FORCE
ROW LEVEL SECURITY` e a política
`USING (organization_id = current_setting('app.current_org')::uuid)` (mesmo predicado em
`WITH CHECK`). O role de aplicação não tem `BYPASSRLS` e não é owner. Sem a GUC
`app.current_org` definida na transação, nada é visível (**fail-closed**).

## 2. Diagrama ER (mermaid)

```mermaid
erDiagram
    organizations ||--o{ memberships : "tem"
    users ||--o{ memberships : "participa"
    users ||--o{ refresh_tokens : "possui"
    organizations ||--o{ invitations : "emite"
    organizations ||--o{ clients : "carteira"
    organizations ||--o{ fiscal_documents : "isola"
    organizations ||--o{ apuracoes : "isola"
    organizations ||--o{ dossiers : "isola"
    organizations ||--o{ subscriptions : "assina"
    organizations ||--o{ usage_records : "consome"
    organizations ||--o{ audit_logs : "registra"
    plans ||--o{ subscriptions : "define"
    clients ||--o{ fiscal_documents : "referente a"
    clients ||--o{ apuracoes : "referente a"
    fiscal_documents ||--o{ fiscal_document_items : "contém"
    apuracoes ||--o{ dossiers : "gera"
    clients ||--o{ dossiers : "referente a"

    organizations {
        uuid id PK
        text name
        citext slug UK
        text status
        timestamptz created_at
        timestamptz deleted_at
    }
    users {
        uuid id PK
        citext email UK
        text hashed_password
        text full_name
        bool is_active
        timestamptz email_verified_at
        timestamptz created_at
        timestamptz deleted_at
    }
    memberships {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        text role
        text status
        uuid invited_by FK
        timestamptz created_at
        timestamptz deleted_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by
    }
    invitations {
        uuid id PK
        uuid organization_id FK
        citext email
        text role
        text token_hash
        timestamptz expires_at
        timestamptz accepted_at
    }
    clients {
        uuid id PK
        uuid organization_id FK
        text cnpj
        text razao_social
        char uf
        text regime
        timestamptz created_at
        timestamptz deleted_at
    }
    fiscal_documents {
        uuid id PK
        uuid organization_id FK
        uuid client_id FK
        text document_type
        text direction
        char access_key
        timestamptz issue_date
        text issuer_cnpj
        text issuer_name
        text receiver_cnpj
        text receiver_name
        text cfop
        numeric total_value
        numeric v_bc_ibscbs
        numeric v_ibs
        numeric v_cbs
        text status
        text source_filename
        text raw_xml_uri
        char content_hash
        timestamptz parsed_at
        timestamptz created_at
        timestamptz deleted_at
    }
    fiscal_document_items {
        uuid id PK
        uuid organization_id FK
        uuid fiscal_document_id FK
        int item_number
        text description
        text cfop
        text ncm
        numeric gross_value
        numeric net_value
        numeric v_bc
        numeric v_ibs
        numeric v_cbs
        text cst
        text rtc_impact
    }
    apuracoes {
        uuid id PK
        uuid organization_id FK
        uuid client_id FK
        date period_start
        date period_end
        text granularity
        numeric creditos
        numeric debitos
        numeric saldo
        numeric idx_credito_entradas
        numeric idx_debito_saidas
        numeric idx_saldo_saidas
        text status
        text engine_version
        jsonb params_snapshot
        uuid created_by FK
        timestamptz created_at
        timestamptz deleted_at
    }
    dossiers {
        uuid id PK
        uuid organization_id FK
        uuid client_id FK
        uuid apuracao_id FK
        text ai_model
        int tokens_input
        int tokens_output
        int cost_cents
        text status
        text content_md
        jsonb context_snapshot
        uuid created_by FK
        timestamptz created_at
        timestamptz deleted_at
    }
    aliquotas {
        uuid id PK
        text tributo
        text escopo
        char uf
        text municipio_ibge
        date vigencia_inicio
        date vigencia_fim
        numeric aliquota
        text fonte
        timestamptz created_at
    }
    plans {
        uuid id PK
        text code UK
        text name
        jsonb limits
        int price_cents
        bool active
    }
    subscriptions {
        uuid id PK
        uuid organization_id FK
        uuid plan_id FK
        text status
        date current_period_start
        date current_period_end
        text stripe_customer_id
        text stripe_subscription_id
        timestamptz created_at
    }
    usage_records {
        uuid id PK
        uuid organization_id FK
        text metric
        date period
        numeric quantity
        timestamptz created_at
    }
    audit_logs {
        uuid id PK
        uuid organization_id FK
        uuid actor_user_id FK
        text action
        text resource_type
        uuid resource_id
        jsonb metadata
        inet ip
        timestamptz created_at
    }
```

## 3. Entidades — papel, chaves e notas

| Entidade | Papel (diagnóstico §4.4) | PK | FKs principais | Notas de modelagem |
|---|---|---|---|---|
| `organizations` | Tenant (escritório/empresa cliente); plano e status | `id` | — | `slug` único (`citext`); `status` (active/suspended); soft-delete. |
| `users` | Pessoa física com login | `id` | — | **Global**, e-mail único (`citext`); `hashed_password` argon2 (ADR 0002); `email_verified_at`. |
| `memberships` | Liga user ↔ org com papel (RBAC) | `id` | `organization_id`, `user_id`, `invited_by` | `role ∈ {owner, admin, membro}`; único `(organization_id, user_id)`; `status` (active/invited/revoked). |
| `refresh_tokens` | Sessões de refresh rotativas | `id` | `user_id`, `replaced_by` | Guarda **hash** do token; `revoked_at`; detecção de reuso (ADR 0002). Global por user. |
| `invitations` | Convite de membro pendente | `id` | `organization_id`, `invited_by` | `email`, `role`, `token_hash`, `expires_at`, `accepted_at`. RLS por org. |
| `clients` | Empresas analisadas (CNPJs) na carteira | `id` | `organization_id` | `cnpj` (com máscara/validação); único `(organization_id, cnpj)`; `regime` (RPA/SN/MEI/UNKNOWN). |
| `fiscal_documents` | Documento fiscal (cabeçalho) | `id` | `organization_id`, `client_id` | `document_type ∈ {NFE,NFCE,CTE,NFSE,UNKNOWN}`; `direction ∈ {INBOUND,OUTBOUND,UNKNOWN}`; `access_key` 44 díg; `raw_xml_uri` aponta p/ object storage (não guarda o XML); `content_hash` p/ dedupe; único `(organization_id, client_id, access_key)`. |
| `fiscal_document_items` | Itens do documento | `id` | `organization_id`, `fiscal_document_id` | `rtc_impact ∈ {CREDIT,DEBIT,NEUTRAL}` (saída do motor fiscal); `cst`, `cfop` (metadado); valores `v_ibs/v_cbs/v_bc`. `organization_id` denormalizado p/ RLS direto. |
| `apuracoes` | Apuração por período (créditos/débitos/saldo/índices) | `id` | `organization_id`, `client_id`, `created_by` | `granularity ∈ {MONTHLY,QUARTERLY}`; `params_snapshot` (versão do motor, ref. de alíquotas) p/ reprodutibilidade; `status ∈ {DRAFT,CLOSED}`. |
| `dossiers` | Relatórios de IA gerados (modelo/tokens/custo) | `id` | `organization_id`, `client_id`, `apuracao_id`, `created_by` | `content_md` (Markdown); `context_snapshot` = agregados **anonimizados** enviados ao Gemini (LGPD); `cost_cents`, `tokens_*`. |
| `aliquotas` | Tabela versionada por vigência (2026–2033) | `id` | — | **Global/referência**; `(tributo, escopo, uf?, municipio_ibge?, vigencia_inicio, vigencia_fim, aliquota, fonte)`. Sem RLS; escrita admin. |
| `plans` | Catálogo de planos | `id` | — | **Global**; `code` único (free/pro/enterprise); `limits` (jsonb: nº docs, dossiês, tokens). |
| `subscriptions` | Assinatura da organização | `id` | `organization_id`, `plan_id` | refs Stripe; `status`; período atual. RLS por org. |
| `usage_records` | Medição de uso p/ cobrança | `id` | `organization_id` | append-only; `(metric, period, quantity)`; agrega consumo (docs, dossiês, tokens). |
| `audit_logs` | Trilha de auditoria (LGPD) | `id` | `organization_id`, `actor_user_id` | **append-only/imutável**; `action`, `resource_type`, `resource_id`, `metadata`, `ip`. RLS por org; admin pode ler tudo via role próprio. |

## 4. Índices principais (acessos reais)

| Tabela | Índices |
|---|---|
| `memberships` | UNIQUE `(organization_id, user_id)`; `(user_id)` p/ "minhas orgs". |
| `users` | UNIQUE `(email)`. |
| `clients` | UNIQUE `(organization_id, cnpj)`; `(organization_id)`. |
| `fiscal_documents` | UNIQUE `(organization_id, client_id, access_key)`; `(organization_id, client_id, issue_date DESC, id)` p/ keyset/período; `(organization_id, cfop)`; `(organization_id, content_hash)` dedupe. |
| `fiscal_document_items` | `(organization_id, fiscal_document_id)`; `(organization_id, rtc_impact)`. |
| `apuracoes` | UNIQUE `(organization_id, client_id, period_start, period_end, granularity)`; `(organization_id, client_id, period_start DESC)`. |
| `dossiers` | `(organization_id, client_id, created_at DESC, id)`; `(organization_id, apuracao_id)`. |
| `aliquotas` | `(tributo, escopo, uf, municipio_ibge, vigencia_inicio)`; busca por vigência (range). |
| `subscriptions` | UNIQUE `(organization_id)` (assinatura ativa única); `(stripe_subscription_id)`. |
| `usage_records` | `(organization_id, metric, period)`. |
| `audit_logs` | `(organization_id, created_at DESC, id)`; `(actor_user_id, created_at DESC)`. |

> Os índices compostos começam por `organization_id` para casar com o filtro do RLS e
> com a paginação keyset definida no ADR 0003.

## 5. Decisões e premissas (apontadas para validação)

1. **PK UUID v7** (ADR 0007): gerada na aplicação (PG 16 sem `uuidv7()` nativo).
2. **`users` global, não tenant-scoped:** um usuário participa de várias organizações
   via `memberships`. Decisão alinhada ao padrão B2B SaaS e ao §4.4 (users + memberships
   separados). Implica autorização cuidadosa na aplicação para `users`/`refresh_tokens`.
3. **`aliquotas` como referência global versionada por vigência:** o motor de cálculo
   usa, por padrão, os **valores destacados no XML** (SPEC_BUSINESS_RULES, premissa 7); a
   tabela serve para **projeção, validação e simulação** da transição 2026–2033. Não tem
   `organization_id`. *Questão aberta:* haverá necessidade de **overrides por
   organização**? Se sim, criar `organization_aliquota_overrides` (tenant-scoped) depois.
4. **Soft-delete (`deleted_at`)** em `organizations`, `memberships`, `clients`,
   `fiscal_documents`, `apuracoes`, `dossiers`. **`audit_logs` e `usage_records` são
   append-only/imutáveis** (não têm soft-delete). *Tensão LGPD:* soft-delete conflita com
   o direito de eliminação — é preciso um caminho de **hard-delete/anonimização** para
   atender o titular (item do oficial-lgpd, Fase 3). Documentar política de retenção.
5. **PII / dados sensíveis em `fiscal_documents`:** `issuer_name`, `receiver_name`,
   `issuer_cnpj`, `receiver_cnpj` são dados pessoais/comerciais; `receiver_cnpj` pode ser
   **CPF de consumidor** (NFC-e). Minimização: gravar `CONSUMIDOR_FINAL` quando anônimo;
   avaliar **criptografia em coluna** para CPF. *Questão aberta para o oficial-lgpd:*
   quais colunas cifrar em repouso e qual a retenção do `raw_xml_uri`.
6. **`organization_id` denormalizado em tabelas-filhas** (`fiscal_document_items`) para
   que a política RLS seja direta (sem JOIN) e os índices comecem por ele.
7. **Reprodutibilidade fiscal:** `apuracoes.params_snapshot` e `engine_version` guardam o
   contexto de cálculo (versão do motor, referência de alíquotas) para auditar/reproduzir
   uma apuração mesmo após mudanças de regra — exigência de precisão fiscal.
8. **Valores monetários** em `numeric` (precisão fiscal), nunca float; percentuais de
   índice também `numeric`. Custos de IA em `cost_cents` (inteiro).

## 6. Mapeamento com o domínio do motor fiscal

O `fiscal_engine` (ADR 0004) define os **tipos puros** (`FiscalDocument`, `FiscalItem`,
`RtcImpact`, resultado de `Apuracao`) independentes do banco. As tabelas
`fiscal_documents`/`fiscal_document_items`/`apuracoes` são a **persistência** desses
tipos; a conversão (domínio ↔ ORM) fica na camada de repositório do `backend/app`, nunca
no engine. A regra de impacto (INBOUND→CREDIT / OUTBOUND→DEBIT / CFOP excluído→NEUTRAL —
SPEC_XML_MAPPING_v2) e o cálculo de apuração (SPEC_BUSINESS_RULES §6) são do engine; o
banco apenas guarda o resultado e o snapshot de parâmetros.

# ADR 0007 — Chaves primárias UUID v7

- **Status:** Aceito (confirmar com o usuário — ver questões abertas)
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com engenheiro-dados)
- **Relacionados:** 0001 (RLS), `docs/data-model.md`

## Contexto

Precisamos escolher a estratégia de chave primária para um schema multi-tenant com
tabelas que vão de poucas linhas (`organizations`) a centenas de milhões
(`fiscal_documents`, `audit_logs`). IDs aparecem em URLs e respostas de API.

## Decisão

Usar **UUID v7** como PK padrão de todas as tabelas.

- **UUID v7** é **ordenável no tempo** (prefixo de timestamp), o que dá **localidade de
  índice** próxima à de um inteiro sequencial (evita a fragmentação de índice do UUID
  v4 aleatório em tabelas grandes/append-only).
- É **não-enumerável**: não vaza contagem de registros nem permite varredura sequencial
  de IDs entre tenants — relevante para um SaaS multi-tenant.
- Geração no **nível da aplicação** (lib de UUID v7 em Python; default do modelo
  SQLAlchemy/Pydantic), porque o **PostgreSQL 16 não tem `uuidv7()` nativo** (função
  nativa chega no PG 18). Armazenado em coluna `uuid`.

## Alternativas consideradas

- **`bigint` identity sequencial:** menor (8 bytes) e rápido, mas **enumerável**
  (vaza volume e permite adivinhar IDs) e cria sequência global compartilhada entre
  tenants; rejeitado para entidades expostas.
- **UUID v4 (aleatório):** não-enumerável, mas **sem localidade temporal** — degrada
  índices e cache em tabelas grandes (write amplification). Pior para `fiscal_documents`.
- **ULID:** propriedades semelhantes ao UUID v7, mas v7 é padrão (RFC 9562) e tem melhor
  suporte de tipo nativo `uuid` no Postgres.

## Consequências

- **Positivas:** IDs seguros para expor, boa performance de índice em tabelas grandes,
  ordenação temporal aproximada "de graça".
- **Negativas / cuidados:**
  - Depende de **lib de aplicação** para gerar v7 até o PG 18 (ou função SQL custom);
    padronizar em um único utilitário no `backend`.
  - 16 bytes vs 8 do bigint — índices um pouco maiores; aceitável frente aos benefícios.
  - O timestamp embutido revela o **momento de criação** do registro; aceitável (não é
    segredo), mas não usar UUID v7 para valores que precisem esconder o instante de
    criação.

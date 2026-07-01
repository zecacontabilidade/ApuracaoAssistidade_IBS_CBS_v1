# ADR 0011 — Fronteira de pureza do `fiscal_engine` imposta por CI (import-linter)

- **Status:** Aceito
- **Data:** 2026-07-01
- **Decisores:** arquiteto-lider (com devops-finops, engenheiro-motor-fiscal)
- **Relacionados:** 0004 (reorg backend/+frontend/ — **supersede parcial**, ver
  Consequências), 0008 (namespace top-level `fiscal_engine`/`app`/`workers`),
  0009 (impacto RTC) e 0010 (apuração/conformidade — "motor fiscal é domínio puro"),
  `backend/pyproject.toml` (`[tool.importlinter]`),
  `.github/workflows/ci.yml` (step `Import boundaries (lint-imports)`),
  `docs/backlog-fatias.md` (F0.6, F1.0, F1.5).

## Contexto

A F0.6 (pipeline de CI) materializou em verificação automatizada o princípio de que
**o motor fiscal é domínio puro** (CLAUDE.md; ADRs 0009/0010). Antes disso, a pureza
existia apenas como convenção e comentário. A fatia introduziu o `import-linter` como
dependência de `dev` (`backend/pyproject.toml`, `import-linter>=2.0`) e um step de CI
(`.github/workflows/ci.yml`, linhas 56-58: `working-directory: backend` / `run:
lint-imports`) que **falha o build** se a fronteira for violada.

O contrato real, hoje, em `backend/pyproject.toml` `[tool.importlinter]`:

```toml
[tool.importlinter]
root_packages = ["fiscal_engine"]
include_external_packages = true            # exigido p/ proibir pacotes de terceiros

[[tool.importlinter.contracts]]
name = "fiscal_engine é puro"
type = "forbidden"
source_modules = ["fiscal_engine"]
forbidden_modules = [
    # intra-repo (camadas de infra e orquestração)
    "app",
    "workers",
    # libs de I/O e framework web
    "fastapi",
    "sqlalchemy",
    "pydantic",
    "lxml",
    "httpx",
    "requests",
    # libs de infraestrutura / persistência / fila / cloud
    "dramatiq",
    "redis",
    "alembic",
    "psycopg",
    "boto3",
]
```

Na revisão da F0.6 **estendeu-se a denylist** com as demais libs de IO/infra que são deps
de runtime — `dramatiq`, `redis`, `alembic`, `psycopg`, `boto3` — para que o engine jamais
alcance fila, cache, migrations, driver de BD ou SDK de nuvem. A extensão **já foi
aplicada** no `pyproject.toml` (o CI protege todos os 13 módulos listados).

## Decisão

1. **Contrato `forbidden` (denylist) é a escolha correta para o estágio atual.** Só
   existe um pacote interno (`fiscal_engine`); `app`/`workers` ainda não nasceram
   (F1.0/F1.x). Os contratos `layers` e `independence` do import-linter exigem **≥2
   pacotes internos** para ter sentido — hoje seriam vacuosos. A denylist expressa
   exatamente a invariante que importa agora: "o engine não importa infraestrutura".

2. **Proibir `pydantic` e `lxml` DENTRO do engine é decisão consciente, não acidente.**
   O motor usa `@dataclass(frozen=True, slots=True)` + `Decimal` (ADR 0010 §7), sem
   acoplamento a framework de validação nem a parser de XML. Até aqui isso vivia só em
   comentário do `pyproject.toml`/HANDOFF; **este ADR o torna decisão citável**: a
   conversão de/para Pydantic é responsabilidade da camada de repositório da aplicação,
   e o parsing de XML é responsabilidade da camada de ingestão (ver item 3).

3. **Os parsers de XML (lxml) vivem FORA de `fiscal_engine`.** Os 4 parsers
   (NF-e/NFC-e/CT-e/NFS-e Nacional) pertencem a um **pacote separado de ingestão** — a
   ser definido na F1.5 (ex.: `parsers/`/`ingestion/`, ou sob `app/`). Eles **alimentam**
   o motor com objetos de domínio já parseados (`FiscalDocument`/`FiscalItem`); o motor
   **nunca** importa `lxml`. A escolha final do nome/topologia do pacote é da F1.5.

4. **Evolução em F1.0/F1.x — adicionar `layers` SEM remover `forbidden`.** Quando
   `app`/`workers` existirem, ACRESCENTAR um contrato `type = "layers"`
   (`app`/`workers` acima de `fiscal_engine`, direção única `app → fiscal_engine`), que
   captura a direção entre pacotes internos. O contrato `forbidden` **permanece**, pois
   `layers` **não cobre bibliotecas de terceiros** (fastapi/sqlalchemy/lxml/etc.).
   Registrar como **fragilidade conhecida**: a denylist é **mantida à mão** — um
   `import` novo de uma lib de IO **não listada** passaria despercebido. Mitigação:
   **sincronizar a denylist a cada nova dependência de runtime** (checklist de PR).
   A extensão (dramatiq/redis/alembic/psycopg/boto3) já foi aplicada na F0.6.

## Alternativas consideradas

- **`type = "layers"` já agora (rejeitada).** Precisa de ≥2 pacotes internos; com só
  `fiscal_engine` seria vacuoso e não pegaria libs de terceiros — que é justamente o
  risco real hoje (IO acidental no domínio).
- **`type = "independence"` (rejeitada).** Modela pacotes que não podem se conhecer
  mutuamente; não há dois pacotes de domínio para isolar neste estágio.
- **Allowlist em vez de denylist (rejeitada por ora).** Listar o que o engine PODE
  importar seria mais robusto contra libs novas, mas o import-linter não oferece
  contrato allowlist nativo e a stdlib tornaria a lista extensa e ruidosa. Reavaliável
  se a fragilidade da denylist doer.
- **Enforcement só por convenção/revisão humana (rejeitada).** Era o estado pré-F0.6;
  frágil e não rastreável. A verdade tem de estar no CI.

## Consequências

- **Positivas:** a invariante "motor fiscal nunca depende de FastAPI/DB/IO" (CLAUDE.md)
  vira **gate de CI** com dentes; a pureza do engine (ADRs 0009/0010) fica protegida
  contra regressão; parsers e conversões Pydantic têm lugar arquitetural explícito
  (fora do engine); caminho de evolução (`layers` na F1.0) documentado.
- **Negativas / cuidados:**
  - Denylist mantida à mão — ver fragilidade em Decisão §4; exige disciplina de PR.
  - `include_external_packages = true` é obrigatório para proibir pacotes de terceiros;
    não remover ao mexer no contrato.
  - **Extensão já aplicada** (dramatiq/redis/alembic/psycopg/boto3 incluídos na F0.6).
    Sincronizar a denylist conforme novas libs de IO/infra entrem no runtime.

### Reconciliação com a ADR 0004 (supersessão parcial)

A ADR 0004 (`docs/adr/0004-reorganizacao-repo-backend-frontend.md`) posiciona os parsers
lxml e "tipos Pydantic opcionais" **dentro** de `fiscal_engine`:

- linha 27 do diagrama: `fiscal_engine/  # MOTOR FISCAL PURO: domínio + apuração + parsers (lxml)`;
- linhas 42-45: "depende apenas de stdlib + `lxml` (+ tipos Pydantic opcionais)".

Isso **contradiz** o contrato F0.6: se os parsers (lxml) ou tipos Pydantic fossem
colocados sob o engine, `lint-imports` **quebraria o CI**. Portanto, **este ADR 0011
supersede essa parte da ADR 0004**: `lxml` e `pydantic` são proibidos dentro de
`fiscal_engine`; os parsers vivem em pacote de ingestão separado (F1.5). O restante da
ADR 0004 (monorepo `backend/`+`frontend/`, engine como pacote irmão, direção
`app → fiscal_engine` enforçada por import-linter) permanece válido. A nota de correção
no corpo da própria ADR 0004 fica a cargo do documentador.

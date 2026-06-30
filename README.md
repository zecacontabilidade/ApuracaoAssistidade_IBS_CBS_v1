# Simples Apuração RTC

SaaS multi-tenant de apuração de IBS/CBS (Reforma Tributária) para contadores e escritórios.

## Stack
- **Backend:** Python 3.12 · FastAPI · PostgreSQL 16 · SQLAlchemy 2 · Alembic
- **Auth:** fastapi-users · JWT (access/refresh) · argon2 · sem Supabase
- **Fila:** Dramatiq · Redis
- **Storage:** MinIO (dev) / AWS S3 (prod)
- **Frontend:** React 19 · Vite · TanStack Query · Recharts
- **Testes:** pytest · Playwright · Vitest

## Estrutura do repositório
```
backend/          # API FastAPI (F1.0+)
  .env.example    # Copie para backend/.env e preencha
  requirements.txt
frontend/         # SPA React+Vite (F0.3+)
docs/
  adr/            # Architecture Decision Records
  api/            # Contrato de API
  backlog-fatias.md
.devcontainer/    # Ambiente de desenvolvimento (Docker)
```

## Desenvolvimento (devcontainer)

Pré-requisitos: VS Code + extensão Dev Containers + Docker Desktop.

```bash
# 1. Abra no container
#    VS Code: F1 → "Dev Containers: Reopen in Container"

# 2. Inicie os serviços de infraestrutura
docker compose -f .devcontainer/docker-compose.yml up -d

# 3. Backend (dentro do container)
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. Frontend (dentro do container)
cd frontend && npm run dev
```

Serviços disponíveis no devcontainer:
| Serviço | Endereço |
|---------|----------|
| API FastAPI | http://localhost:8000 |
| Frontend Vite | http://localhost:5173 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| MinIO API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin) |

## Qualidade do backend

Todos os comandos abaixo rodam **de dentro do container** e com `cwd = /workspace/backend`
(ver [ADR 0008](docs/adr/0008-layout-de-pacote-e-cwd-de-tooling-do-backend.md)):

```bash
# Prerequisito: pip install -e "backend[dev,test]" (feito automaticamente no post-create.sh)
# Este comando DEVE rodar antes de qualquer ferramenta (ruff, mypy, pytest, pre-commit).

cd /workspace/backend

# Lint + formatação
ruff check .           # Detecta issues de estilo/segurança
ruff format .          # Formata código (line-length=100)

# Type-check (strict)
mypy .                 # Verifica tipos com Pydantic + SQLAlchemy plugins

# Testes + cobertura
pytest                 # Executa suite (motor ≥95%, demais ≥80% — F0.7+)
pytest --cov           # Com relatório de cobertura
pytest --cov --cov-report=html  # Gera HTML em htmlcov/

# Git hooks (roda de /workspace, não /workspace/backend)
cd /workspace
pre-commit run --all-files  # Lint/format/type-check antes de commits
```

**Nota importante:** o `pre-commit install` foi executado no post-create.sh.
Ele depende de `pip install -e "backend[dev,test]"` já estar feito (tools: ruff, mypy, etc.).
Se clonar o repo afresh, rode `pip install -e "backend[dev,test]"` **antes** de `pre-commit run`.

## Qualidade do frontend

Todos os comandos abaixo rodam **de dentro do container** e com `cwd = /workspace/frontend`
(ver F0.5):

```bash
# Prerequisito: npm install (feito automaticamente no post-create.sh)
# Este comando DEVE rodar antes de qualquer ferramenta (eslint, prettier, tsc, vitest).

cd /workspace/frontend

# Lint + formatação
npm run lint           # ESLint com regras strict para código novo, warns para legado
npm run lint:fix       # Corrige issues de lint automaticamente
npm run format         # Prettier (printWidth 100, singleQuote false, semi, trailing comma)
npm run format:check   # Verifica se o código está formatado

# Type-check (strict)
npm run typecheck      # tsc --noEmit com strict mode ativo

# Testes + cobertura
npm run test           # Vitest (modo run — executa uma vez)
npm run test:watch     # Vitest (modo watch — executa ao salvar)
npm run test:coverage  # Com relatório de cobertura (≥70% threshold)

# Git hooks (roda de /workspace, não /workspace/frontend)
cd /workspace
pre-commit run --all-files  # ESLint + Prettier check antes de commits
```

**Nota importante:** o `pre-commit install` foi executado no post-create.sh.
Ele depende de `npm install` já estar feito no `frontend/` (hooks usam `frontend/node_modules/.bin`).
Se clonar o repo afresh, rode `npm install --prefix frontend` **antes** de `pre-commit run`.

## Documentação
- [ADRs](docs/adr/) — decisões de arquitetura
- [Contrato de API](docs/api/contrato-api-v1.md)
- [Modelo de dados](docs/data-model.md)
- [Backlog de fatias](docs/backlog-fatias.md)

## Branches
- `main` — produção (somente releases aprovadas)
- `develop` — integração contínua

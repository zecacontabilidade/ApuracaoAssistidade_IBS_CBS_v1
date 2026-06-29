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

## Documentação
- [ADRs](docs/adr/) — decisões de arquitetura
- [Contrato de API](docs/api/contrato-api-v1.md)
- [Modelo de dados](docs/data-model.md)
- [Backlog de fatias](docs/backlog-fatias.md)

## Branches
- `main` — produção (somente releases aprovadas)
- `develop` — integração contínua

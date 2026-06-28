# Avaliação do Devcontainer vs Stack Obrigatória (insumo da fatia F0.0)

> Documento de design. Atualizado após a execução da **F0.0 (devops-finops)**.
> Status: **RESOLVIDO** — todos os serviços sobem com healthchecks verdes, conectividade
> confirmada (db/redis/minio). Pendências planejadas para Fase 1+ listadas abaixo.

## 1. Estado atual (após F0.0)

| Arquivo | Conteúdo relevante |
|---|---|
| `.devcontainer/devcontainer.json` | nome `simples-apuracao-rtc`; compose; service `app`; workspace `/workspace`; feature Node **20**; `forwardPorts` **8000, 5173, 5432, 6379, 9000, 9001** (MinIO adicionado); `postCreateCommand` roda `post-create.sh`; extensões `ms-python.python`, `charliermarsh.ruff`, `ms-playwright.playwright`; `portsAttributes` com labels; `remoteUser` `vscode`. |
| `.devcontainer/docker-compose.yml` | `app` + `worker` (build do Dockerfile, monta `..:/workspace`, `sleep infinity`, envs de DB/Redis/S3 completas, `depends_on: db+redis+minio com condition: service_healthy`); `db` postgres:**16** com healthcheck `pg_isready`; `redis` redis:**7** com healthcheck `redis-cli ping`; `minio` **minio/minio:RELEASE.2025-09-07T16-13-09Z** (tag datada, não `:latest`) com healthcheck `mc ready local`, volume `miniodata`, portas **127.0.0.1**:9000/9001 (loopback). |
| `.devcontainer/Dockerfile` | `FROM mcr.microsoft.com/devcontainers/python:3.12`; apt: `postgresql-client`, `redis-tools`, `curl`; playwright OS deps instalados como root (`pip install playwright && playwright install-deps chromium && pip uninstall playwright`). |
| `.devcontainer/post-create.sh` | `pip upgrade`; instala `backend/requirements.txt` **se existir**; `frontend && npm install` **se existir**; `playwright install chromium` (sem `--with-deps` — OS deps já na imagem). |
| `backend/.env.example` | **NOVO**: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `JWT_SECRET` (placeholder), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `GEMINI_API_KEY` (vazio), `ENVIRONMENT=development`. Sem valores reais. |

## 2. O que já cobre (PASSA)

- **Python 3.12** (requisito: 3.12+) e **Node 20** (Vite 6/React 19 ok). ✔
- **PostgreSQL 16** e **Redis 7** como serviços, ambos com **healthchecks**. ✔
- **`DATABASE_URL` com driver `psycopg` (psycopg3)** — coerente com SQLAlchemy 2.0. ✔
- **`REDIS_URL`** pronto para a fila (ADR 0005). ✔
- **Portas** do backend (8000), front (5173), Postgres (5432), Redis (6379), **MinIO API (9000), MinIO Console (9001)**. ✔
- **Tooling no container** (regra de ouro): deps via `post-create`, nunca no host. ✔
- **Extensões** de Python, Ruff e Playwright. ✔
- **`depends_on` com `condition: service_healthy`** — elimina race condition no boot. ✔
- **MinIO** como object storage S3-compatível (dev only). ✔
- **Serviço `worker`** placeholder (Dramatiq, ADR 0005) — não quebra o `up`. ✔
- **`backend/.env.example`** com todas as chaves necessárias, sem segredos reais. ✔
- **Playwright OS deps** no Dockerfile (root, camada cacheada) — post-create sem sudo. ✔
- **Ferramentas de SO** para diagnóstico: `postgresql-client`, `redis-tools`, `curl`. ✔

## 3. Lacunas originais — status após F0.0

| # | Lacuna | Severidade | Status |
|---|---|---|---|
| L1 | **Sem object storage (MinIO/S3)** | Alta | **RESOLVIDO** — serviço `minio` adicionado, healthcheck, volume `miniodata`, variáveis S3_* em `app` e `worker`. |
| L2 | **Sem serviço `worker`** | Alta | **RESOLVIDO** — serviço `worker` adicionado com placeholder `sleep infinity`. Comando Dramatiq real entra na Fase 1 (F1.x). |
| L3 | **`depends_on` sem `condition: service_healthy` e sem healthchecks** | Média | **RESOLVIDO** — healthchecks em `db` (pg_isready) e `redis` (redis-cli ping); `app` e `worker` usam `condition: service_healthy`. |
| L4 | **Sem `backend/.env.example`** | Média | **RESOLVIDO** — arquivo criado em `backend/.env.example` com todos os placeholders necessários. |
| L5 | **`backend/requirements.txt` e `frontend/` ainda inexistentes** | Média (planejada) | **Planejada para F0.2/F1.0** — `post-create` tolera ausência com `|| true`. |
| L6 | **Portas do MinIO não encaminhadas** | Baixa | **RESOLVIDO** — `forwardPorts` agora inclui 9000 e 9001 com labels. |
| L7 | **`playwright install --with-deps` exige apt/root** | Baixa | **RESOLVIDO** — OS deps movidos para o Dockerfile (build como root, camada cacheada). `post-create` usa `playwright install chromium` (sem `--with-deps`). |
| L8 | **Sem readiness de migrations / seed** | Baixa | **Fora do escopo F0.0** — entra em F0.2 (alembic upgrade head) e F1.x (bucket MinIO). |
| L9 | **Node 20 vs 22 LTS** | Baixa (opcional) | **Mantido Node 20** — estável e funcional. Reavaliação em F0.2 se necessário. |
| L10 | **Sem limites de recursos / `.dockerignore`** | Baixa | **Fora do escopo F0.0** — entra em F0.4 ou posterior. |

## 4. Validação Docker (executada em F0.0)

```
docker compose -f .devcontainer/docker-compose.yml config   # OK — sintaxe válida
docker compose -f .devcontainer/docker-compose.yml build    # OK — app + worker built
docker compose -f .devcontainer/docker-compose.yml up -d    # OK — todos iniciaram

NAME                    IMAGE                                    STATUS
devcontainer-app-1      devcontainer-app                         Up (healthy deps)
devcontainer-db-1       postgres:16                              Up (healthy)
devcontainer-minio-1    minio/minio:RELEASE.2025-09-07T16-13-09Z Up (healthy)
devcontainer-redis-1    redis:7                                  Up (healthy)
devcontainer-worker-1   devcontainer-worker                      Up (healthy deps)

Conectividade:
  db    → pg_isready -U app -d apuracao          → "accepting connections"  OK
  redis → redis-cli ping                         → "PONG"                   OK
  minio → mc ready local (via exec no container) → cluster ready             OK

docker compose down  # recursos removidos; volumes retidos
```

## 5. Decisões tomadas em F0.0

1. **Playwright OS deps no Dockerfile:** `pip install playwright && playwright install-deps chromium && pip uninstall playwright`. Abordagem: instala temporariamente o pacote Python para usar o CLI do playwright (que conhece as deps exatas), depois remove. Evita manter o pacote e elimina o `--with-deps` do post-create. Browser binários instalados no post-create via `npx playwright install chromium`.

2. **MinIO healthcheck via `mc ready`:** imagem `minio/minio` baseada em Red Hat UBI micro **não inclui curl**; inclui o cliente `mc`. Healthcheck configura um alias temporário e executa `mc ready local`, que acessa o endpoint interno sem depender de ferramentas externas. Tag fixada em `RELEASE.2025-09-07T16-13-09Z` (não `:latest`) para garantir reprodutibilidade; atualizar manualmente e re-validar ao bumpar a versão.

3. **Portas MinIO vinculadas ao loopback (`127.0.0.1`):** as portas 9000/9001 são publicadas apenas na interface de loopback do host, não em `0.0.0.0`. O acesso do VS Code continua via `forwardPorts`; a exposição na rede local do host é evitada — boa prática de segurança para serviços com credenciais de dev.

4. **`app` e `worker` dependem de `minio: service_healthy`:** dado que ambos carregam `S3_*`, esperar o MinIO estar pronto antes de iniciar evita falhas de conexão ao S3 no boot.

5. **Credenciais MinIO `minioadmin/minioadmin`:** exclusivamente para o ambiente local de desenvolvimento. Documentadas como DEV ONLY em comentários no compose e no `backend/.env.example`. Em produção: AWS S3 + IAM + Secrets Manager.

6. **Worker com `sleep infinity`:** placeholder seguro. O compose sobe sem erro; o comando Dramatiq real é inserido na Fase 1 (F1.x) quando `backend/requirements.txt` existir com dramatiq instalado.

7. **`backend/` criado apenas com `.env.example`:** a reorganização física do repositório em `backend/`/`frontend/` é escopo de F0.2, não de F0.0.

## 6. Pendências para próximas fatias

- **F0.2:** reorganizar repo (`backend/`, `frontend/`), criar `backend/requirements.txt`, `frontend/package.json`, `frontend/.env.example`; remover/substituir `.env.example` raiz; configurar `.dockerignore`; `alembic upgrade head` no post-create se backend existir.
- **F1.x:** substituir `sleep infinity` no worker pelo comando Dramatiq; criar bucket `xml-raw` no MinIO no primeiro boot (mc mb ou script de inicialização).
- **F0.4+:** limites de recursos nos serviços; `.dockerignore` para acelerar builds.

## 7. Gates F0.0

- **guarda-custos-aws:** N/A — todo o ambiente é local (Docker Compose, custo zero de nuvem). O design do MinIO local espelha a interface S3 (mesmo SDK/endpoint) para que a migração para AWS S3 na Fase 4 seja apenas mudança de variável de ambiente, sem nenhum recurso AWS provisionado agora.
- **revisao-lgpd:** N/A — F0.0 não toca dado pessoal ou fiscal; manipula apenas infraestrutura de container e placeholders de configuração.

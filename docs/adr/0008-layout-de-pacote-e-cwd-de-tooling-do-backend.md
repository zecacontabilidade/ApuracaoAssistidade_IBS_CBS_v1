# ADR 0008 — Layout de pacote e cwd de tooling do backend

- **Status:** Aceito
- **Data:** 2026-06-29
- **Decisores:** arquiteto-lider (com devops-finops, engenheiro-backend)
- **Relacionados:** 0004 (reorg backend/+frontend/), 0005 (worker Dramatiq),
  `.devcontainer/post-create.sh`, `backend/pyproject.toml`, `.pre-commit-config.yaml`,
  `docs/backlog-fatias.md` (F0.4, F0.7, F1.0, F1.5)

## Contexto

A F0.4 (tooling de qualidade backend) introduziu `backend/pyproject.toml`. Ao
configurá-lo surgiu uma decisão transversal que F0.7 (motor puro), F1.0 (scaffold
FastAPI) e F1.5 (parsers) herdam: **qual é o namespace de import do código Python e a
partir de qual diretório (cwd) o tooling roda.**

O `post-create.sh` de HEAD (`04e43a9`) já carregava uma **inconsistência**:

- API: `cd /workspace/backend && uvicorn app.main:app` — cwd em `backend/`, pacote
  top-level `app`.
- Worker: `cd /workspace && python -m dramatiq backend.app.tasks` — cwd em `/workspace`,
  pacote top-level `backend`.

A F0.4 resolveu a tensão tornando `backend/` um pacote Python (`backend/__init__.py`) e
elegendo `/workspace` como cwd canônico, com `setuptools package-dir = {"" = ".."}` e
caminhos de tooling relativos a `/workspace`
(`--cov-config=backend/pyproject.toml`, `--cov-report=xml:backend/coverage.xml`).

**Consequência comprovada:** o gesto convencional `cd backend && pytest` quebra com
`ConfigError: Couldn't read 'backend/pyproject.toml'`, porque `--cov-config` é relativo
ao cwd e resolve para `/workspace/backend/backend/pyproject.toml`. Só funciona de
`/workspace`. Isso contraria a ergonomia Python usual e a intenção da ADR 0004, que fala
em "engine como **pacote separado dentro de** `backend/`" (i.e. `fiscal_engine`, e não
`backend.fiscal_engine`).

Este é o momento mais barato para fixar a convenção: **não existe nenhum código de
aplicação ainda** (sem `app/`, sem `fiscal_engine/`, sem `tasks.py`); só o esqueleto.

## Decisão

Adotar o **layout convencional**: o cwd canônico do tooling do backend é
**`/workspace/backend`** e os pacotes Python são top-level **dentro** de `backend/`.

- `backend/` é uma **pasta do monorepo, não um pacote Python**. Remover
  `backend/__init__.py`. Os pacotes instaláveis/importáveis são `app`, `fiscal_engine`
  e `workers` (criados nas fatias que os introduzem).
- `backend/pyproject.toml` é **auto-descoberto** (é o rootdir): sem
  `package-dir = {"" = ".."}`, sem `--cov-config`, sem prefixo `backend/` em paths de
  relatório. Descoberta normal de pacotes
  (`[tool.setuptools.packages.find] include = ["app*", "fiscal_engine*", "workers*"]`).
- **Invocações canônicas** (todas de `/workspace/backend`):
  - testes: `pytest` (cobertura `--cov=app --cov=fiscal_engine`, relatório
    `--cov-report=xml:coverage.xml`)
  - lint/format: `ruff check .` / `ruff format .`
  - tipos: `mypy .`
  - API: `uvicorn app.main:app --reload` (restaura a linha original da F0.0)
  - worker: `python -m dramatiq app.tasks` (corrige a linha do worker)
  - install editable: `pip install -e backend[dev,test]` (de `/workspace`) ou
    `pip install -e .[dev,test]` (de `/workspace/backend`) — ambos válidos, pois o
    `pyproject.toml` vive em `backend/`.
- **Fronteira do engine (F0.7) por import-linter** passa a referenciar `fiscal_engine`
  e `app` (em vez de `backend.fiscal_engine`/`backend.app`): `fiscal_engine` **não pode
  importar** `app`; `app` pode importar `fiscal_engine`.
- **pre-commit não muda de convenção**: o `pre-commit` sempre roda a partir da raiz do
  repositório, então `files: ^backend/` e `args: ["--config-file", "backend/pyproject.toml", "backend/"]`
  permanecem corretos e independentes do cwd do desenvolvedor.

A ADR 0004 permanece válida; este ADR **explicita e corrige** a suposição de namespace
`backend.*`/cwd `/workspace` que havia se infiltrado no `post-create.sh` e na F0.4.

## Alternativas consideradas

- **Opção A — `backend` como pacote top-level, cwd `/workspace`** (estado da F0.4 antes
  desta decisão). Prós: `import backend`, namespace único `backend.*`, um só cwd no
  monorepo. Contras: **footgun de DX** (`cd backend && pytest/ruff/mypy` quebra); paths
  de tooling frágeis e relativos ao cwd; atrito com Alembic, runners de IDE, Dockerfile
  (`WORKDIR /app; COPY backend/`), e CI (que convenciona `working-directory` por área).
  O suposto "um cwd para o monorepo" é ilusório: o `frontend/` já roda de `frontend/`
  com npm, então o backend rodar de `/workspace` não unifica nada — apenas afasta o
  tooling do diretório do projeto. **Rejeitada.**
- **Opção C — layout `src/` com pacote de distribuição único** (`backend/src/...`).
  Isola melhor o namespace de imports de terceiros, mas adiciona cerimônia
  desnecessária para um dev solo neste estágio. **Adiada** (reavaliável se o engine virar
  pacote publicado, como já previsto na ADR 0004).

## Consequências

- **Positivas:** ergonomia Python padrão (`cd backend && pytest`); zero "path tricks";
  CI/Docker/Alembic/IDE triviais; alinhamento com a intenção da ADR 0004
  (`fiscal_engine` como pacote irmão dentro de `backend/`); F0.7/F1.0/F1.5 nascem na
  convenção certa.
- **Negativas / cuidados:**
  - `app`/`fiscal_engine`/`workers` ficam como pacotes top-level no venv do
    devcontainer — aceitável em ambiente dedicado (é o padrão de cookiecutters
    FastAPI); revisitar com Opção C se houver colisão futura.
  - **Cobertura no esqueleto:** sem código de produto, gate de cobertura é vacuoso.
    Os limiares ficam **configurados** na F0.4 mas só passam a ter dentes quando houver
    código: `app ≥ 80%` na F1.0 e `fiscal_engine ≥ 95%` na F0.7 (medição por pacote,
    pois um único `--cov-fail-under` não expressa limiares diferentes por domínio).
  - Mudança a aplicar agora (devops-finops): remover `backend/__init__.py`; limpar
    `package-dir`/`--cov-config`/prefixos `backend/` do `pyproject.toml`; ajustar
    `known-first-party`, `addopts` e o smoke test (dropar `import backend`); corrigir as
    linhas de uvicorn/worker/testes no `post-create.sh`.

FROM mcr.microsoft.com/devcontainers/python:3.12

# ---------------------------------------------------------------------------
# Ferramentas de SO: instaladas como root durante o build (camada cacheada).
#   postgresql-client  — pg_isready, psql (diagnóstico + migrations futuras)
#   redis-tools        — redis-cli (diagnóstico)
#   curl               — healthchecks e debug HTTP
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    redis-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Playwright — dependências de SO instaladas aqui como root para evitar sudo
# no post-create. O Python playwright é removido após instalar os pacotes de
# sistema; os binários dos navegadores (Chromium) são instalados no post-create
# via 'npx playwright install chromium'.
# ---------------------------------------------------------------------------
RUN pip install --quiet --no-cache-dir playwright \
    && playwright install-deps chromium \
    && pip uninstall -y playwright

# ---------------------------------------------------------------------------
# Node 20 LTS é injetado pela devcontainer feature (ghcr.io/.../node:1).
# Dependências de aplicação (pip / npm) são instaladas no post-create.sh,
# sempre DENTRO do container — nunca no host (regra de ouro 9).
# ---------------------------------------------------------------------------

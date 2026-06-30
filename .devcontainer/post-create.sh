#!/usr/bin/env bash
# Tudo aqui roda DENTRO do container — nunca no host (regra de ouro 9).
set -euo pipefail

echo "==> Atualizando pip..."
python -m pip install --upgrade pip

# ---------------------------------------------------------------------------
# Backend Python — instalação editable com extras dev + test (F0.4+)
# Fonte de verdade: backend/pyproject.toml
# O comando abaixo instala runtime + ruff + mypy + pre-commit + pytest + httpx.
# backend/requirements.txt é apenas um shim documental — não usar para instalar.
# ---------------------------------------------------------------------------
echo "==> Instalando backend Python em modo editable (pyproject.toml)..."
pip install -e "backend[dev,test]"

echo "==> Instalando dependências npm do frontend (se frontend/package.json existir)..."
if [ -f /workspace/frontend/package.json ]; then
  (cd /workspace/frontend && npm install)
fi

# Playwright: as dependências de SO (libxyz, libnss, etc.) já foram instaladas
# no Dockerfile como root (camada cacheada). Aqui instalamos apenas os binários
# dos navegadores — não precisa de sudo nem de --with-deps.
echo "==> Instalando Claude Code CLI (persiste via volume ~/.claude)..."
npm install -g @anthropic-ai/claude-code

echo "==> Instalando navegadores do Playwright (Chromium)..."
npx --yes playwright install chromium

# ---------------------------------------------------------------------------
# pre-commit — instala git hooks locais (lint/format/type-check antes de commit)
# DEVE rodar DEPOIS de pip install (hooks ruff/mypy usam language: system e
# dependem de ruff/mypy instalados via pip install -e "backend[dev,test]").
# ---------------------------------------------------------------------------
echo "==> Instalando git hooks via pre-commit..."
pre-commit install

echo ""
echo "Devcontainer pronto. cwd canônico do backend: /workspace/backend (ADR 0008)."
echo ""
echo "  API:      cd /workspace/backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  (F1.0+)"
echo "  worker:   cd /workspace/backend && python -m dramatiq app.tasks  (F1.x)"
echo "  frontend: cd /workspace/frontend && npm run dev"
echo ""
echo "  testes:   cd /workspace/backend && pytest"
echo "  lint:     cd /workspace/backend && ruff check . && ruff format --check ."
echo "  tipos:    cd /workspace/backend && mypy ."
echo ""
echo "  install (de dentro de backend/):"
echo "    cd /workspace/backend && pip install -e '.[dev,test]'"
echo ""
echo "  MinIO console: http://localhost:9001  (usuario: minioadmin / senha: minioadmin)"

#!/usr/bin/env bash
# Tudo aqui roda DENTRO do container — nunca no host (regra de ouro 9).
set -euo pipefail

echo "==> Atualizando pip..."
python -m pip install --upgrade pip

echo "==> Instalando dependências Python do backend (se backend/requirements.txt existir)..."
if [ -f /workspace/backend/requirements.txt ]; then
  pip install -r /workspace/backend/requirements.txt
fi

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

echo ""
echo "Devcontainer pronto."
echo "  backend:  cd /workspace/backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "  frontend: cd /workspace/frontend && npm run dev"
echo "  worker:   cd /workspace && python -m dramatiq backend.app.tasks  (Fase 1)"
echo "  MinIO console: http://localhost:9001  (usuario: minioadmin / senha: minioadmin)"

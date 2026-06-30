"""Smoke tests: ambiente correto e dependências críticas disponíveis.

NÃO é teste de produto — não há lógica de negócio nesta fatia (F0.4).
Objetivo: manter o pipeline CI verde e verificar o ambiente de desenvolvimento.

Política de cobertura por domínio (ADR 0008 / Opção B):
  - fiscal_engine/  >= 95%  (gate ativado em F0.7, motor fiscal puro)
  - app/            >= 80%  (gate ativado em F1.0, scaffold FastAPI)
  - workers/        >= 80%  (gate ativado em F1.x)
  - frontend        >= 70%  (tooling F0.5, via vitest)
"""

import sys

import fastapi
import pydantic


def test_python_version() -> None:
    """Python >= 3.12 é obrigatório (CLAUDE.md stack)."""
    assert sys.version_info >= (3, 12), f"Python 3.12+ obrigatório, encontrado: {sys.version_info}"


def test_fastapi_version() -> None:
    """FastAPI >= 0.115 (CLAUDE.md stack)."""
    parts = fastapi.__version__.split(".")
    assert len(parts) >= 2, "Versão FastAPI inesperada"
    assert (int(parts[0]), int(parts[1])) >= (0, 115), (
        f"FastAPI >= 0.115 obrigatório, encontrado: {fastapi.__version__}"
    )


def test_pydantic_v2() -> None:
    """Pydantic v2 obrigatório — v1 é incompatível com a stack."""
    major = int(pydantic.__version__.split(".")[0])
    assert major >= 2, f"Pydantic v2+ obrigatório, encontrado: {pydantic.__version__}"

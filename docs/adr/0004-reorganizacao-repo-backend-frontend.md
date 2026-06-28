# ADR 0004 — Reorganização do repositório em `backend/` + `frontend/`

- **Status:** Aceito
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com devops-finops)
- **Relacionados:** `.devcontainer/post-create.sh`, `docs/devcontainer-assessment.md`

## Contexto

O repositório hoje mistura, na raiz, um protótipo Vite SPA (`src/`, `index.html`,
`vite.config.ts`, `package.json` com `name: "react-example"`) e um proxy Express
(`server.ts`). O `post-create.sh` do devcontainer **já espera** uma estrutura
`backend/requirements.txt` e `frontend/package.json` que ainda não existe (instala "se
existir"). A arquitetura-alvo separa apresentação, API de domínio, motor fiscal puro e
dados (diagnóstico §4.1) e a regra de ouro exige **domínio puro independente de
framework/IO** e o **motor fiscal sem dependência de FastAPI/DB**.

## Decisão

Adotar **monorepo** com a seguinte topologia de alto nível:

```
/
├── backend/
│   ├── app/                 # FastAPI: routers, services, repositories, core/config
│   ├── fiscal_engine/       # MOTOR FISCAL PURO: domínio + apuração + parsers (lxml)
│   │                        # sem imports de FastAPI/SQLAlchemy/IO de rede
│   ├── alembic/             # migrations
│   ├── tests/               # pytest (unit do engine, integração da API+DB)
│   ├── pyproject.toml / requirements.txt
│   └── .env.example
├── frontend/                # SPA React + Vite (migração do protótipo atual)
│   ├── src/                 # módulos por funcionalidade (quebra do App.tsx)
│   └── package.json
├── infra/                   # docker/compose de produção, IaC (Fase 4)
├── docs/                    # contrato de API, data-model, ADRs, LGPD
└── .devcontainer/           # já existente
```

- O **motor fiscal** (`backend/fiscal_engine/`) é um pacote Python **puro**: depende
  apenas de stdlib + `lxml` (+ tipos Pydantic opcionais), **nunca** de FastAPI, do ORM
  ou de IO de rede/DB. A direção de dependência (`app` → `fiscal_engine`, nunca o
  contrário) é **enforçada por lint** (`import-linter` ou regra equivalente) no CI.
- O protótipo atual da raiz é **movido para `frontend/`**; `name: "react-example"` é
  renomeado; o `.env.example` antigo (AI Studio/Gemini) é substituído por
  `backend/.env.example` e `frontend/.env.example` adequados.
- Um único ambiente Python por enquanto (um `requirements.txt`/`pyproject` em
  `backend/`), mantendo o engine como pacote separado dentro dele — simples para o dev
  solo e alinhado ao `post-create.sh`.

## Alternativas consideradas

- **Manter tudo na raiz:** conflita com o `post-create.sh` e dificulta a separação de
  responsabilidades; rejeitado.
- **Motor fiscal como repositório/pacote publicado separado:** isolamento máximo, mas
  overhead de versionamento/publish desnecessário para um dev solo neste estágio.
  Mantemos a opção aberta promovendo `fiscal_engine` a pacote independente depois.
- **Engine dentro de `backend/app/`:** facilita imports, mas enfraquece a fronteira que
  garante pureza; preferimos pacote irmão com a regra de import enforçada.
- **Poly-repo (backend e frontend separados):** mais cerimônia de CI/versionamento para
  ganho baixo num produto inicial mantido por uma pessoa.

## Consequências

- **Positivas:** fronteiras claras (a regra "motor fiscal nunca depende de FastAPI/DB"
  vira verificação automatizada), devcontainer passa a instalar o que espera, caminho
  natural para CI por área e para deploy independente.
- **Negativas / cuidados:**
  - A reorganização é uma fatia de "higiene" (F0.2) que mexe em muitos caminhos; deve
    ser feita cedo, antes de qualquer código novo, e validada com build dentro do
    container.
  - É preciso configurar e manter a regra de import-linter no CI desde o início.
  - Histórico de git dos arquivos movidos muda de caminho (usar `git mv`).

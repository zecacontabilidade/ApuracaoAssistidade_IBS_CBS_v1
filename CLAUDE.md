# Simples Apuração RTC — Regras do Projeto (CLAUDE.md)

## Missão
Transformar o protótipo em um SaaS multi-tenant profissional e comercializável:
backend FastAPI + PostgreSQL, autenticação própria (SEM Supabase), multi-tenant
com Row-Level Security, motor fiscal IBS/CBS isolado e testado, frontend React
refatorado, LGPD by design e deploy AWS com custo otimizado.

## Stack obrigatória
- Backend: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic.
- Banco: PostgreSQL 16. Multitenancy = schema compartilhado + coluna
  organization_id + RLS. Proibido vazar dados entre tenants.
- Auth: fastapi-users (ou Authlib) + JWT (access/refresh), hashing argon2. SEM Supabase.
- Assíncrono: fila para lotes de XML (Celery/Dramatiq/ARQ + Redis ou SQS).
- Parsing XML: lxml com resolução de entidades externas DESABILITADA (anti-XXE).
- Frontend: React + Vite, React Router, TanStack Query, Recharts.
- Testes: pytest (unit/integração), Playwright (e2e), Vitest (unit do front).
- Infra: Docker; AWS (ver guarda-custos-aws). Postgres gerenciado não-Supabase.
- Dev: **devcontainer obrigatório** — todo o tooling (Python, Node, dependências,
  Playwright, Postgres/Redis) roda DENTRO do container, nunca no host.

## Regras de ouro (HARD RULES)
1. **Time especializado, nunca genérico.** Trabalho de especialista vai SEMPRE ao
   subagent nomeado correspondente. É proibido usar `general-purpose`. Para busca
   ampla de código use `explorador`; para planejar use `arquiteto-lider`.
2. **Sem commit/push sem aprovação humana explícita.** Use a skill
   `portao-de-commit`. O agente prepara o commit e PARA. Nunca commite sozinho.
3. **Pirâmide de testes é o "pronto".** Toda fatia adiciona/atualiza testes:
   muitos unit, alguns de integração, poucos e2e (Playwright) nos fluxos críticos.
   Cobertura mínima: motor fiscal ≥ 95%, demais domínios ≥ 80%, front ≥ 70%.
   Nada é "pronto" com teste vermelho.
4. **Fatiar por contexto.** Uma fatia = unidade coesa e pequena, que cabe com
   folga no contexto. Ao atingir ~50% de uso de contexto, ou ao fim de uma fatia,
   gere `HANDOFF.md` (skill `handoff-sessao`) e RECOMENDE sessão nova com o prompt
   de retomada. Não "empurre" trabalho numa janela já cheia.
5. **LGPD by design.** Toda fatia que toca dado pessoal/fiscal passa por
   `revisao-lgpd`. Minimização, base legal, retenção, criptografia, trilha de
   auditoria e tratamento do sub-processador de IA (Gemini) são obrigatórios.
6. **FinOps em toda decisão de infra.** Antes de escolher recurso AWS, rode
   `guarda-custos-aws`. Prefira serverless/managed com autoscaling e right-sizing.
7. **Rastreabilidade.** Decisões arquiteturais viram ADR em `docs/adr/`. Commits
   seguem Conventional Commits. Docs são atualizados na mesma fatia (documentador).
8. **Segurança.** Sem segredos no código; validar toda entrada; sem dados reais em
   teste; least privilege em tokens, RLS e IAM.
9. **Devcontainer sempre.** Todo comando, build, teste e instalação executa DENTRO
   do devcontainer, NUNCA no host. Se faltar uma dependência, adicione-a à imagem/
   feature/postCreate do devcontainer e reconstrua o container — não instale no host.

## Definition of Done (por fatia)
- [ ] Código no escopo da fatia, dentro da arquitetura em camadas.
- [ ] Testes unit + integração novos/atualizados; e2e quando há fluxo de usuário.
- [ ] Todos os testes verdes; cobertura dentro das metas; lint/format/type-check ok.
- [ ] `revisao-lgpd` aprovada (se toca dados) e `guarda-custos-aws` (se toca infra).
- [ ] `revisao-final` (revisor-codigo + arquiteto-lider) sem bloqueios.
- [ ] Docs/ADRs atualizados.
- [ ] Commit PREPARADO e aguardando aprovação humana (não commitado).

## Roteamento (quem faz o quê)
arquiteto-lider · engenheiro-backend · engenheiro-dados · especialista-auth-seguranca ·
engenheiro-motor-fiscal · engenheiro-frontend · qa-tester · devops-finops ·
oficial-lgpd · revisor-codigo · documentador · explorador.
(Definições completas em .claude/agents/. O orquestrador só pode invocar estes.)

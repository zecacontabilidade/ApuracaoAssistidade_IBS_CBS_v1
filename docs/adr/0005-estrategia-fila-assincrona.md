# ADR 0005 — Estratégia de fila assíncrona para lotes de XML

- **Status:** Aceito (recomendação; confirmar com o usuário — ver questões abertas)
- **Data:** 2026-06-27
- **Decisores:** arquiteto-lider (com engenheiro-backend, engenheiro-motor-fiscal,
  devops-finops)
- **Relacionados:** 0004 (repo), `docs/devcontainer-assessment.md`

## Contexto

O produto precisa processar **lotes de 5.000 a 50.000 XMLs** por período (PRD §3,
RNF-01) de forma assíncrona, com status/progresso, fora do ciclo request/response
(diagnóstico §4.6). A stack obrigatória admite **Celery, Dramatiq ou ARQ + Redis** no
dev e **SQS** como alvo possível na AWS. O devcontainer já provê Redis.

Característica decisiva da carga: o parsing de XML com `lxml` é **CPU-bound**
(predominante no volume de lotes), enquanto chamadas a Gemini/S3/DB são **I/O-bound**.
O modelo de execução do worker precisa lidar bem com CPU-bound.

## Decisão

Adotar **Dramatiq + Redis** como executor de tarefas assíncronas no dev/MVP, atrás de
uma **porta de aplicação `TaskQueue`** (interface fina de enfileiramento/consumo)
para permitir trocar o backend sem reescrever o domínio.

Justificativa:

- **Dramatiq** usa **workers em processos (prefork)**, o que escala naturalmente para
  trabalho **CPU-bound** (parsing em lote), tem retries/middleware robustos e é
  significativamente mais simples de operar que o Celery.
- A **porta `TaskQueue`** desacopla o produtor (FastAPI) do executor; na AWS podemos
  apontar para **SQS** (consumidores nativos ou broker compatível) sem tocar a lógica
  de negócio — alinhado ao FinOps (escala a zero, sem broker sempre ligado).
- Os **XMLs brutos** vão para object storage (MinIO no dev, S3 em prod); a fila carrega
  **referências** (chaves de objeto/IDs), não os payloads.
- O job é **idempotente** e particionável (por documento/lote), com status persistido
  para o progresso aparecer na UI.

## Alternativas consideradas

- **ARQ + Redis:** elegante e async-native (asyncio), excelente para cargas
  **I/O-bound** e integra muito bem com FastAPI. Porém seu modelo single-process
  asyncio é fraco para CPU-bound (parsing bloqueia o event loop) a menos que se faça
  offload manual para process pool — complexidade extra. **Runner-up**: preferível se o
  gargalo real se mostrar I/O (Gemini/S3) e não CPU.
- **Celery + Redis:** o mais maduro e cheio de recursos, mas pesado, configuração
  complexa e ergonomia inferior para um dev solo; reservado caso surjam necessidades
  avançadas de roteamento/orquestração.
- **SQS direto desde o dev:** ótimo para prod (managed, escala a zero), mas atrita o
  loop local de desenvolvimento; preferimos Redis no dev e SQS atrás da mesma porta em
  prod.
- **Sem fila (processar no request):** inviável para 50k XMLs (timeouts, bloqueio);
  rejeitado. No MVP, apenas lotes **pequenos** podem ser síncronos (F1.6); lotes
  grandes exigem a fila (F2.2).

## Consequências

- **Positivas:** bom desempenho em CPU-bound, operação simples, portabilidade para SQS
  via porta `TaskQueue`, Redis já disponível no devcontainer.
- **Negativas / cuidados:**
  - É preciso adicionar um **serviço `worker`** ao docker-compose do devcontainer
    (hoje ausente — ver assessment) e ao deploy.
  - Workers prefork consomem mais memória que um único processo asyncio; right-sizing é
    item de FinOps.
  - A porta `TaskQueue` precisa ser desenhada cedo (Fase 2) para não acoplar o backend a
    Dramatiq.
  - **Confirmar a escolha com o usuário** antes de implementar (questão aberta): se o
    perfil de carga pender para I/O, ARQ pode ser preferível.

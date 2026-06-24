# Prompt de Início de Projeto — Simples Apuração RTC
## Template para orientar qualquer IA a implementar este projeto do zero
---

> **Como usar este arquivo:**
> Copie o conteúdo da seção "PROMPT COMPLETO" abaixo e cole como primeira
> mensagem ao iniciar uma nova conversa com qualquer IA (Claude, GPT-4, Gemini).
> Depois faça o upload dos arquivos .md conforme as instruções.

---

# ════════════════════════════════════════════
# PROMPT COMPLETO — COPIE A PARTIR DAQUI
# ════════════════════════════════════════════

Olá. Vamos iniciar um projeto de desenvolvimento de software do zero.
Antes de qualquer código, preciso que você leia, processe e confirme
o entendimento de toda a documentação que vou compartilhar.

---

## 1. CONTEXTO DO PROJETO

Estou desenvolvendo uma aplicação web chamada **Simples Apuração RTC**
— uma ferramenta para contadores e gestores fiscais apurarem créditos
e débitos de **IBS/CBS** (Imposto sobre Bens e Serviços e Contribuição
sobre Bens e Serviços), instituídos pela Lei Complementar 214/2025
como parte da Reforma Tributária do Consumo brasileira.

O projeto foi concebido, planejado e parcialmente implementado.
Vou compartilhar a documentação completa para que você entenda
exatamente o que foi decidido, o que foi construído e como continuar.

---

## 2. OS DOCUMENTOS QUE VOU COMPARTILHAR

Vou fazer upload de até 4 arquivos de documentação. Cada um tem um
papel específico e complementar. Leia todos antes de qualquer ação.

### Arquivo 1 — PRD_v3.md (Product Requirements Document)
**O que é:** documento de produto. Define o PROBLEMA que o software
resolve, PARA QUEM resolve, e O QUE precisa ser construído.

**O que você encontrará:**
- Contexto da Reforma Tributária do Consumo (LC 214/2025)
- Proposta de valor e princípios do produto
- 3 personas: Contador Tributarista, Controller Fiscal, Auditor
- 47 requisitos funcionais organizados em 7 módulos (RF-01 a RF-07)
- Requisitos não funcionais (segurança, performance, privacidade)
- O que está FORA do escopo desta versão
- Métricas de sucesso

**Por que é importante:** define o que construir e por quê.
Sem o PRD, o desenvolvimento perde foco e entrega funcionalidades
que ninguém pediu.

### Arquivo 2 — SPEC_ARCHITECTURE_v3.md (Especificação Técnica)
**O que é:** documento técnico. Define COMO o software é construído —
stack, arquitetura, padrões, segurança, testes e infraestrutura.

**O que você encontrará:**
- Stack tecnológica completa com versões (Next.js 15, TypeScript 5,
  React 19, Zustand 5, fast-xml-parser 5, Recharts, Supabase, Gemini)
- Diagrama de arquitetura em 4 camadas
- Estrutura completa de arquivos e responsabilidade de cada um
- Fluxos de dados: processamento de XMLs, geração de dossiê, autenticação
- Modelo de dados: FiscalDocument, AiContext (com regra de privacidade)
- Headers HTTP de segurança configurados
- Vulnerabilidades auditadas (XXE, XML bomb, XSS, prototype pollution)
- Estratégia de testes: 118 testes em 8 arquivos, com fixtures XML reais
- Variáveis de ambiente e suas responsabilidades
- Instruções de deploy no Vercel e configuração do Supabase

**Por que é importante:** sem a SPEC, o código será inconsistente,
inseguro ou difícil de manter. A SPEC codifica decisões que levaram
horas de análise e não devem ser refeitas.

### Arquivo 3 — ROADMAP.md
**O que é:** histórico do que foi feito e planejamento do futuro.

**O que você encontrará:**
- Sprints 0–6 detalhados com o que foi entregue em cada um
- Decisões técnicas e por que foram tomadas
- Correções realizadas durante o desenvolvimento (bugs reais e soluções)
- 12 Architecture Decision Records (ADRs) — decisões com alternativas e motivos
- Backlog de Sprints 7–10 e Versão 2.0

**Por que é importante:** evita repetir erros. Cada ADR registra
uma decisão que foi debatida — não refazer sem motivo fundamentado.

### Arquivo 4 — CONTRIBUTING.md
**O que é:** guia prático para qualquer desenvolvedor ou IA continuar
o projeto sem perder contexto.

**O que você encontrará:**
- Setup completo em 5 minutos
- Padrões de código e arquitetura
- **7 armadilhas documentadas** com causas e soluções exatas
- Como adicionar novos parsers de documentos fiscais
- Como gerenciar usuários no Supabase
- Detalhes sobre o prompt da IA e o modelo de dados do contexto

**Por que é importante:** as armadilhas documentadas representam
problemas reais que ocorreram e foram resolvidos. Ignorá-las
significa retrabalho de horas.

---

## 3. COMO PROCEDER APÓS LER OS DOCUMENTOS

### Passo A — Confirmar entendimento
Após ler todos os arquivos, responda com um resumo do que entendeu
sobre: (1) o problema que o software resolve, (2) a stack técnica,
(3) o que já foi implementado, (4) o que está pendente.

Não continue sem essa confirmação — ela garante que estamos alinhados.

### Passo B — Definir o escopo da sessão
Me diga o que deseja implementar nesta sessão:
- Continuar a partir do Sprint 7 (backlog)
- Corrigir algo específico
- Implementar do zero (caso seja uma nova instância sem código)

### Passo C — Design antes de código
Para qualquer funcionalidade nova, siga este processo obrigatório:

```
1. DESIGN: descreva o que vai implementar (arquivos, fluxo, decisões)
2. SELF-TEST: liste possíveis inconsistências ou riscos antes de codar
3. IMPLEMENTAÇÃO: escreva o código com testes
4. VALIDAÇÃO: confirme build limpo + testes passando
5. ENTREGA: empacote em ZIP se for entrega completa
```

Nunca pule o design. A qualidade do projeto vem do planejamento.

### Passo D — Regras invioláveis
Estas regras devem ser respeitadas em qualquer implementação:

**Privacidade:**
O `AiContextService.ts` é o guardião de privacidade.
Ele NUNCA deve incluir CNPJs, nomes de empresas ou chaves de acesso
no objeto `AiContext` enviado ao Gemini. Auditar com testes.

**Testes:**
Nenhum código é entregue com testes falhando.
O baseline atual é 118 testes passando. Só pode crescer.

**Build:**
`npm run build` deve ser limpo (zero erros TypeScript) antes de
qualquer entrega.

**Middleware:**
Em Next.js 15 com diretório `src/`, o middleware DEVE estar em
`src/middleware.ts` — nunca na raiz do projeto.

**Autenticação:**
O logout usa `window.location.href` (não `router.push()`).
A verificação de sessão usa cookies, não @supabase/ssr no middleware.

**Chaves de API:**
`GEMINI_API_KEY` fica em `process.env` no servidor (Route Handler).
Nunca usar `NEXT_PUBLIC_` para ela.

---

## 4. STACK E VERSÕES (referência rápida)

```json
{
  "framework":      "Next.js 15 (App Router)",
  "linguagem":      "TypeScript 5 (strict mode)",
  "ui":             "React 19 + Tailwind CSS 4",
  "estado":         "Zustand 5 (persist middleware)",
  "xml_parsing":    "fast-xml-parser 5",
  "zip":            "JSZip 3",
  "excel":          "SheetJS xlsx 0.18 (write-only)",
  "graficos":       "Recharts",
  "icones":         "Lucide React",
  "ia":             "Google Gemini API REST (streaming SSE)",
  "markdown":       "react-markdown + remark-gfm",
  "fontes":         "@fontsource/outfit + @fontsource/ibm-plex-mono",
  "auth":           "Supabase Auth (@supabase/supabase-js + @supabase/ssr)",
  "testes":         "Vitest 4 + @testing-library/react 16",
  "deploy":         "Vercel (Edge Runtime + Serverless)",
  "banco":          "Supabase (apenas auth.users — sem tabelas próprias)"
}
```

---

## 5. CONTEXTO DO NEGÓCIO (para a IA entender o domínio)

### O que é IBS/CBS
IBS (Imposto sobre Bens e Serviços) e CBS (Contribuição sobre Bens
e Serviços) substituem gradualmente ICMS, ISS, PIS e COFINS entre
2026 e 2033, conforme LC 214/2025. São tributos duais, não-cumulativos,
com princípio do destino.

### O que são os documentos fiscais processados
- **NF-e (v4.0):** Nota Fiscal Eletrônica — circulação de mercadorias
- **NFC-e (v4.0):** Nota Fiscal Consumidor — varejo/B2C
- **CT-e (v3.0):** Conhecimento de Transporte Eletrônico
- **NFS-e:** Nota Fiscal de Serviços Eletrônica

Cada documento XML contém tags `<vIBS>` e `<vCBS>` em nível de item
e em totais. O projeto extrai esses valores para calcular a apuração.

### Regimes tributários relevantes
- **RPA (Regime Normal/Lucro Real/Presumido):** apura IBS/CBS plenamente
- **Simples Nacional:** regime simplificado — análise especial de migração
- **MEI:** microempreendedor individual — similar ao Simples

### A análise mais sofisticada do projeto
Para empresas do Simples Nacional, o dossiê de IA considera:
- **Perfil de compras:** fornecedores RPA com IBS/CBS vs. Simples sem
- **Perfil de vendas:** B2B (para CNPJs) vs. B2C (para CPF/consumidor)
- **Matriz de risco:** Simples+B2B+compras_com_IBS = alto risco competitivo
  (clientes empresas perdem crédito ao comprar de fornecedor Simples)

---

## 6. INFRAESTRUTURA NECESSÁRIA (para deploy funcional)

### Vercel
- Conta gratuita em vercel.com
- Variáveis de ambiente:
  - `GEMINI_API_KEY` → chave do Google AI Studio (gratuita)
  - `NEXT_PUBLIC_SUPABASE_URL` → URL do projeto Supabase
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → chave anon do Supabase

### Supabase
- Conta gratuita em supabase.com
- Projeto criado na região South America (São Paulo)
- Authentication → Email → desabilitar Sign Up e Email Confirmation
- Usuários criados manualmente em Authentication → Users

### Google AI Studio
- Conta em aistudio.google.com
- Criar API Key gratuita
- Free Tier: 15 requisições/minuto, sem custo

---

## 7. O QUE FAZER APÓS LER ESTE PROMPT

1. **Faça upload** dos arquivos .md que possuo (PRD_v3.md,
   SPEC_ARCHITECTURE_v3.md, ROADMAP.md, CONTRIBUTING.md)
2. **Leia todos** com atenção antes de responder
3. **Confirme o entendimento** conforme Passo A acima
4. **Me diga** o que deseja implementar ou continuar

Estou pronto para começar quando você confirmar o entendimento.

---

## NOTA PARA A IA

Este projeto foi desenvolvido ao longo de múltiplas sessões com
planejamento rigoroso. A qualidade do resultado é diretamente
proporcional ao rigor do processo: design primeiro, testes sempre,
build limpo antes de entregar.

A documentação não é burocracia — é a memória do projeto.
Cada decisão registrada nos ADRs do ROADMAP.md evitou pelo menos
uma hora de retrabalho. Respeite-a.

# ════════════════════════════════════════════
# FIM DO PROMPT — ATÉ AQUI
# ════════════════════════════════════════════

---

## GUIA DE USO — INSTRUÇÕES PARA O HUMANO

### Quais arquivos fazer upload e em que ordem

```
OBRIGATÓRIOS (fazer upload juntos, antes de escrever qualquer coisa):
  1. PRD_v3.md              ← o QUÊ construir
  2. SPEC_ARCHITECTURE_v3.md ← o COMO construir

RECOMENDADOS (enriquecem muito o contexto):
  3. ROADMAP.md             ← histórico e decisões
  4. CONTRIBUTING.md        ← armadilhas e padrões
```

### Como fazer o upload em diferentes IAs

**Claude (claude.ai):**
- Clique no ícone de clipe/anexo na caixa de mensagem
- Selecione os arquivos .md um a um (ou todos de uma vez)
- Cole o prompt acima na mensagem
- Envie tudo junto

**ChatGPT (chat.openai.com):**
- Clique no "+" ou ícone de arquivo
- Faça upload dos .md
- Cole o prompt na mensagem
- Envie

**Gemini (gemini.google.com):**
- Clique no ícone de arquivo/imagem
- Selecione os .md
- Cole o prompt
- Envie

**Nota:** algumas IAs têm limite de tamanho de arquivo ou número
de arquivos por mensagem. Se necessário, comece com PRD + SPEC
e envie ROADMAP + CONTRIBUTING em seguida.

---

### Por que a ordem de leitura importa

A IA precisa entender na seguinte sequência:
1. **Problema** (PRD) → por que este software existe
2. **Solução técnica** (SPEC) → como foi construído
3. **Histórico** (ROADMAP) → o que foi tentado e o que funcionou
4. **Prática** (CONTRIBUTING) → como trabalhar neste projeto

Sem essa sequência, a IA pode propor soluções que contradizem
decisões já tomadas (e que levaram horas para ser tomadas).

---

### Sinais de que a IA entendeu o projeto

A IA demonstrou entendimento quando:
- ✅ Menciona a LC 214/2025 e o contexto da RTC espontaneamente
- ✅ Sabe distinguir IBS/CBS de ICMS/PIS/COFINS
- ✅ Menciona que o middleware deve estar em `src/` (não na raiz)
- ✅ Sabe que `GEMINI_API_KEY` não pode ser NEXT_PUBLIC_
- ✅ Respeita a regra de privacidade do AiContext (sem CNPJs)
- ✅ Propõe testes antes de entregar código

### Sinais de alerta — a IA não leu os documentos

- ❌ Sugere usar `router.push()` no logout
- ❌ Propõe colocar o middleware na raiz do projeto
- ❌ Sugere incluir CNPJs no contexto da IA
- ❌ Propõe importar @supabase/ssr no middleware
- ❌ Entrega código sem mencionar testes

---

### Dicas para sessões longas

Os melhores resultados ocorrem quando:

**1. Uma funcionalidade por sessão**
Não misture "implementar login" com "criar novo parser".
Cada sessão com escopo claro e fechado.

**2. Exija o design antes do código**
Peça: "Antes de codar, descreva o que vai implementar,
quais arquivos serão criados/modificados e possíveis riscos."

**3. Valide sempre antes de aceitar**
Peça: "Rode os testes e mostre o resultado antes de entregar."
Nunca aceite código sem confirmação de `npm test` passando.

**4. Documente decisões novas**
Qualquer decisão de arquitetura nova → peça para adicionar
um novo ADR no ROADMAP.md com o formato:
`| ADR-XX | Decisão | Alternativa | Motivo |`

**5. Compacte ao fim de cada sessão**
Após implementar algo, peça:
"Atualize o ROADMAP.md e o CONTRIBUTING.md com o que foi feito."
Isso mantém a documentação sempre sincronizada com o código.

---

### Mensagem de continuidade entre sessões

Se estiver retomando um projeto em andamento (não do zero),
adicione ao início do prompt:

```
[CONTINUIDADE]
Os seguintes sprints já foram implementados e homologados:
Sprint 0-2: fundação, parsers, apuração básica
Sprint 3: análise temporal
Sprint 4: segurança + módulo IA (Gemini)
Sprint 6: autenticação (Supabase)

O código atual está no repositório:
https://github.com/CamargoRomuloNegi/Simples-Apuracao-RTC

Testes: 118/118 passando
Build: limpo
Deploy: https://ebpos-simples-apuracao-rtc.vercel.app

Próximo passo: [descreva o que quer implementar]
```


// LEGADO: será substituído pelo backend FastAPI (F1.0). Não expandir.
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure Gemini is initialized lazily and handled gracefully
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features might fail.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FOR_BUILD",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // API route to calculate taxes or analyze with Gemini
  app.post("/api/analyze", async (req, res) => {
    try {
      const { regime, totalPurchases, totalSales, documents, purchasesFromSimplesCount, salesToCompaniesCount } = req.body;
      
      // Privacy Guard: ensure no sensitive keys, CNPJs, or company names are present in metadata sent to AI.
      // We explicitly filter and clean documents context before compiling the prompt.
      const cleanedDocuments = (documents || []).map((doc: any, idx: number) => ({
        id: `Doc_${idx + 1}`,
        type: doc.type, // e.g., "NFe", "NFCe", "CTe", "NFSe"
        direction: doc.direction, // "entrada" or "saida"
        valIbs: Number(doc.valIbs || 0),
        valCbs: Number(doc.valCbs || 0),
        totalVal: Number(doc.totalVal || 0),
        hasIbsCbs: !!(doc.valIbs || doc.valCbs),
      }));

      const totalCreditsIBS = cleanedDocuments
        .filter((d: any) => d.direction === "entrada")
        .reduce((sum: number, d: any) => sum + d.valIbs, 0);

      const totalCreditsCBS = cleanedDocuments
        .filter((d: any) => d.direction === "entrada")
        .reduce((sum: number, d: any) => sum + d.valCbs, 0);

      const totalDebitsIBS = cleanedDocuments
        .filter((d: any) => d.direction === "saida")
        .reduce((sum: number, d: any) => sum + d.valIbs, 0);

      const totalDebitsCBS = cleanedDocuments
        .filter((d: any) => d.direction === "saida")
        .reduce((sum: number, d: any) => sum + d.valCbs, 0);

      // Constructing detailed prompt for the Brazilian Tax Reform LC 214/2025 expert
      const prompt = `
Você é o "Simples Apuração RTC AI Expert", um consultor e auditor tributarista especialista na Reforma Tributária do Consumo brasileira (Lei Complementar 214/2025).
Por favor, analise os dados financeiros e fiscais compilados abaixo e elabore um dossiê de diagnóstico estratégico detalhado.

DADOS DA EMPRESA (Tudo anonimizado conforme regras de privacidade):
- Regime Tributário Atual: ${regime} (RPA - Regime Normal, Simples Nacional ou MEI)
- Total de Compras/Entradas: R$ ${Number(totalPurchases || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de Vendas/Saídas: R$ ${Number(totalSales || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Quantidade de compras fornecidas por parceiros do Simples Nacional: ${purchasesFromSimplesCount || 0}
- Quantidade de vendas destinadas a pessoas jurídicas (B2B): ${salesToCompaniesCount || 0}

APURAÇÃO APURADA DOS DOCUMENTOS ENVIADOS:
- Total de Créditos de IBS (sobre Compras): R$ ${totalCreditsIBS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de Créditos de CBS (sobre Compras): R$ ${totalCreditsCBS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de Débitos de IBS (sobre Vendas): R$ ${totalDebitsIBS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de Débitos de CBS (sobre Vendas): R$ ${totalDebitsCBS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

INFORMAÇÕES DE DOCUMENTOS EMITIDOS:
${JSON.stringify(cleanedDocuments, null, 2)}

DIRETRIZES DE RETORNO DO DOSSIÊ (Por favor, responda estruturado em formato Markdown elegante, no idioma Português brasileiro):
1. **Resumo Executivo**: Apresente uma análise objetiva do perfil de crédito/débito da empresa sob o prisma do novo regime dual (IBS/CBS).
2. **Eficiência de Crédito**: Analise a relação entre compras totais vs créditos efetivamente obtidos. Compras de fornecedores do Simples Nacional sob a LC 214/2025 reduzem a capacidade do comprador de se creditar integralmente. Comente este impacto caso a empresa compre de optantes do Simples Nacional.
3. **Risco Competitivo de Vendas**: Sob os novos tributos (IBS/CBS), o modelo de crédito financeiro integral gera um enorme desafio para optantes do Simples Nacional que vendem para o mercado corporativo (B2B). Clientes RPA preferirão comprar de RPA para obter crédito de IBS/CBS de 100% da alíquota padrão. Analise a exposição da empresa nesse cenário baseado nas vendas corporativas informadas.
4. **Análise de Lucratividade / Recomendação de Migração**: Forneça um direcionamento claro se a empresa deve avaliar a permanência no Simples/MEI ou se beneficiaria da migração para o RPA (Regime Normal), ou se deve recolher o IBS/CBS "por fora" do Simples Nacional (opção autorizada pela Reforma para garantir aos compradores B2B créditos integrais).
5. **Mitigação de Riscos Fiscais**: Dicas de planejamento fiscal prático sob a transição da Reforma Tributária.

Mantenha uma linguagem extremamente técnica, assertiva, precisa e encorajadora para o profissional contábil.
Evite qualquer menção a nomes fictícios ou chaves de documentos reais. Foque integralmente na inteligência analítica de negócios.
`;

      const ai = getGeminiClient();
      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          success: true,
          isMock: true,
          text: `### 📂 Dossiê de Diagnóstico Estratégico (Demonstrativo - Sem conexão de API)

Sua chave de API do Gemini não está configurada nos segredos do sistema. Todavia, como especialista tributário da **Reforma Tributária (LC 214/2025)**, posso identificar os seguintes pontos com base nos seus dados:

1. **Análise do Regime (${regime})**:
   - A empresa opera sob o regime **${regime}**, com R$ ${Number(totalSales || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de faturamento e R$ ${Number(totalPurchases || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de compras.
   - Foram apurados **Créditos de R$ ${(totalCreditsIBS + totalCreditsCBS).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}** e **Débitos de R$ ${(totalDebitsIBS + totalDebitsCBS).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}**.

2. **Eficiência Contábil e de Créditos**:
   - Compras concentradas em parceiros RPA geram créditos plenos de IBS/CBS. Caso compre de empresas do Simples Nacional, os créditos podem ser parciais ou inexistentes na alíquota padrão, gerando uma sobrecarga de custo implícita.

3. **Risco Competitivo B2B**:
   - Com **${salesToCompaniesCount} clientes corporativos (B2B)**, se a empresa optar por permanecer com recolhimento unificado do Simples sem recolhimento destacado de IBS/CBS por fora, esses clientes corporativos perderão créditos valiosos de ~26.5% (IBS/CBS estimado). Isso criará uma pressão comercial severa para migração de regime ou ajuste de preços.

4. **Recomendação Preliminar**:
   - Avaliar a alteração para o regime **RPA** ou optar pelo recolhimento de IBS/CBS pelo regime geral (por fora do Simples Nacional), preservando a competitividade no varejo corporativo B2B e maximizando o aproveitamento de créditos na cadeia produtiva.

*Insira sua GEMINI_API_KEY no painel de segredos para obter um relatório personalizado ultra-detalhado gerado por Inteligência Artificial cognitiva.*`
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });

      res.json({
        success: true,
        text: response.text,
      });

    } catch (error: any) {
      console.error("Error analyzing with Gemini:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro interno de processamento na inteligência fiscal."
      });
    }
  });

  // Serve static UI assets with Vite or express.static
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Simples Apuração RTC] Back-end running securely on port http://localhost:${PORT}`);
  });
}

startServer();

import { jsPDF } from "jspdf";
import { CfopGroupTotals, TaxRegime } from "../types";

interface ExportPdfParams {
  companyName: string;
  cnpj: string;
  regime: TaxRegime;
  payIbsCbsPorFora: boolean;
  currentRevenue: number;
  currentCost: number;
  calculatedDebitsIbs: number;
  calculatedDebitsCbs: number;
  calculatedCreditsIbs: number;
  calculatedCreditsCbs: number;
  hasDocs: boolean;
  cfopGroups: CfopGroupTotals[];
  aiAnalysis: string | null;
}

export function generateReportPDF(params: ExportPdfParams) {
  const {
    companyName,
    cnpj,
    regime,
    payIbsCbsPorFora,
    currentRevenue,
    currentCost,
    calculatedDebitsIbs,
    calculatedDebitsCbs,
    calculatedCreditsIbs,
    calculatedCreditsCbs,
    hasDocs,
    cfopGroups,
    aiAnalysis
  } = params;

  // Create document
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 15;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - 2 * margin; // 180
  let y = 15;
  let pageNum = 1;

  // Helper: Format currency
  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Helper: Draw Header and Footer on every page
  const drawPageDecorations = (currentPage: number) => {
    // Top border line
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.rect(0, 0, pageWidth, 4, "F");

    // Header text
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("Simples Apuração RTC — Solução Analítica & Inteligente", margin, 10);
    doc.text(new Date().toLocaleDateString("pt-BR"), pageWidth - margin - 20, 10);

    // Bottom decorative footer
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.rect(margin, pageHeight - 12, contentWidth, 0.2, "F");
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(
      "Documento gerado em conformidade com as diretrizes da Reforma Tributária (LC 214/2025).",
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${currentPage}`, pageWidth - margin - 15, pageHeight - 8);
  };

  // Helper to safely transition to a new page
  const checkNewPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      pageNum++;
      drawPageDecorations(pageNum);
      doc.setFont("Helvetica", "normal");
      y = 18; // reset y on new page
    }
  };

  // --- START FIRST PAGE DESIGN ---
  drawPageDecorations(pageNum);

  // 1. BRAND HEADER BLOCK
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 24, "F");

  // Title brand
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("SIMPLES APURAÇÃO RTC", margin + 6, y + 9);

  // Subtitle
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(129, 140, 248); // Indigo-300
  doc.text("Harmonização Inteligente e Parecer Fiscal para Reforma Tributária 2026", margin + 6, y + 15);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text("Revisão Assistida por IA • Projeção IBS/CBS", margin + 6, y + 20);

  // Legal badge
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(pageWidth - margin - 35, y + 5, 29, 5, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("LC 214/2025 ATIVA", pageWidth - margin - 32, y + 8.5);

  y += 29;

  // 2. METADATA CARDS (Two columns)
  doc.setFillColor(248, 250, 252); // Slate-50 background card
  doc.rect(margin, y, contentWidth, 22, "F");
  doc.setDrawColor(226, 232, 240); // Slate-200 border
  doc.rect(margin, y, contentWidth, 22, "S");

  // Left Column
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text("EMPRESA:", margin + 5, y + 6);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(companyName, margin + 25, y + 6);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("CNPJ:", margin + 5, y + 11);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(cnpj, margin + 25, y + 11);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("REGIME TRIB:", margin + 5, y + 16);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229); // Indigo
  doc.text(regime + (payIbsCbsPorFora ? " (IBS/CBS recolhidos por fora)" : ""), margin + 25, y + 16);

  // Right Column
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("TIPO RELATÓRIO:", margin + 110, y + 6);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Balanço e Parecer Técnico", margin + 140, y + 6);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("FONTE DE DADOS:", margin + 110, y + 11);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(hasDocs ? 16 : 100, hasDocs ? 185 : 116, hasDocs ? 129 : 139); // Emerald vs slate
  doc.text(hasDocs ? "Documentos XML Unificados" : "Dados de Projeção Manual", margin + 140, y + 11);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("EXPORTADO EM:", margin + 110, y + 16);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleString("pt-BR"), margin + 140, y + 16);

  y += 28;

  // 3. APURAÇÃO GERAL SUMMARY Table/Block
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Resumo Geral de Apuração (IBS + CBS)", margin, y);
  
  // Underline
  doc.setFillColor(79, 70, 229);
  doc.rect(margin, y + 1.5, 65, 0.6, "F");
  
  y += 6;

  // Table header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, y, contentWidth, 6.5, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("CONVENÇÃO / FLUXO", margin + 4, y + 4.5);
  doc.text("VOLUME BASE (R$)", margin + 65, y + 4.5);
  doc.text("IBS (17.7%) APURADO", margin + 105, y + 4.5);
  doc.text("CBS (8.8%) APURADO", margin + 145, y + 4.5);

  y += 6.5;

  // Rows generator helper
  const drawRow = (label: string, base: number, ibs: number, cbs: number, isTotal: boolean = false) => {
    if (isTotal) {
      doc.setFillColor(241, 245, 249); // highlighted total row
      doc.rect(margin, y, contentWidth, 7.5, "F");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(51, 65, 85);
    }
    
    // borders
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + (isTotal ? 7.5 : 7), margin + contentWidth, y + (isTotal ? 7.5 : 7));

    doc.setFontSize(7.5);
    doc.text(label, margin + 4, y + (isTotal ? 5 : 4.5));
    doc.text(`R$ ${formatBRL(base)}`, margin + 65, y + (isTotal ? 5 : 4.5));
    doc.text(`R$ ${formatBRL(ibs)}`, margin + 105, y + (isTotal ? 5 : 4.5));
    doc.text(`R$ ${formatBRL(cbs)}`, margin + 145, y + (isTotal ? 5 : 4.5));

    y += isTotal ? 7.5 : 7;
  };

  drawRow("ENTRADAS (Créditos Estimados / Insumos)", currentCost, calculatedCreditsIbs, calculatedCreditsCbs);
  drawRow("SAÍDAS (Débitos Estimados / Faturamento)", currentRevenue, calculatedDebitsIbs, calculatedDebitsCbs);

  // Computations
  const netIbs = calculatedDebitsIbs - calculatedCreditsIbs;
  const netCbs = calculatedDebitsCbs - calculatedCreditsCbs;
  const netTotal = netIbs + netCbs;
  
  drawRow(
    "IMPOSTO NET APURADO (Competência Corrente)", 
    currentRevenue - currentCost, 
    netIbs, 
    netCbs, 
    true
  );

  y += 6;

  // Visual highlights: Total payable & Status box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 18, "S");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("IMPOSTO DEVIDO COMBINADO (IBS + CBS):", margin + 6, y + 6);
  
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  const isCredito = netTotal < 0;
  doc.setTextColor(isCredito ? 16 : 79, isCredito ? 185 : 70, isCredito ? 129 : 229); // blue vs green
  doc.text(
    `R$ ${formatBRL(Math.abs(netTotal))} ${isCredito ? " (SALDO CREDOR)" : " (A RECOLHER)"}`, 
    margin + 6, 
    y + 13
  );

  // Right message
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "O valor acima expressa o resultado fiscal líquido obtido pela",
    margin + 110,
    y + 6
  );
  doc.text(
    "harmonia entre as entradas e saídas no simulador RTC.",
    margin + 110,
    y + 10
  );
  doc.setFont("Helvetica", "bold");
  doc.text(
    `Alíquota Global de Impacto: ${(currentRevenue > 0 ? (netTotal / currentRevenue) * 100 : 0).toFixed(2)}%`,
    margin + 110,
    y + 14
  );

  y += 24;

  // 4. DETALHAMENTO CFOP TABLE
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Apuração e Consolidação de Entrada/Saída por CFOP", margin, y);

  doc.setFillColor(79, 70, 229);
  doc.rect(margin, y + 1.5, 92, 0.6, "F");

  y += 6;

  // CFOP Table headers
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, y, contentWidth, 6, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("CFOP", margin + 4, y + 4);
  doc.text("FLUXO", margin + 18, y + 4);
  doc.text("DESCRIÇÃO FISCAL SEFAZ", margin + 45, y + 4);
  doc.text("VALOR TOTAL", margin + 115, y + 4);
  doc.text("IBS APURADO", margin + 140, y + 4);
  doc.text("CBS APURADO", margin + 162, y + 4);

  y += 6;

  // Print each CFOP group
  cfopGroups.forEach((group) => {
    // line height is 6.5
    checkNewPage(6.5);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, 6.5, "F");
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(group.cfop, margin + 4, y + 4);

    // Fluxo stamp
    const isEntradaGroup = group.direction === "entrada";
    doc.setTextColor(isEntradaGroup ? 16 : 79, isEntradaGroup ? 185 : 70, isEntradaGroup ? 129 : 229);
    doc.setFont("Helvetica", "bold");
    doc.text(isEntradaGroup ? "ENTRADA" : "SAÍDA", margin + 18, y + 4);

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    let shortLabel = group.label;
    if (shortLabel.length > 34) {
      shortLabel = shortLabel.substring(0, 32) + "...";
    }
    doc.text(shortLabel, margin + 45, y + 4);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`R$ ${formatBRL(group.totalVal)}`, margin + 115, y + 4);

    doc.setFont("Helvetica", "normal");
    doc.text(`R$ ${formatBRL(group.valIbs)}`, margin + 140, y + 4);
    doc.text(`R$ ${formatBRL(group.valCbs)}`, margin + 162, y + 4);

    y += 6.5;
  });

  y += 12;

  // 5. THE AI REPORT SECTION
  if (aiAnalysis) {
    checkNewPage(40);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Parecer Técnico & Recomendações (IA Gemini Fiscal)", margin, y);

    doc.setFillColor(79, 70, 229);
    doc.rect(margin, y + 1.5, 95, 0.6, "F");

    y += 7;

    // We process the markdown paragraphs from Gemini to fit well in the PDF
    const paragraphs = aiAnalysis.split("\n\n");
    
    paragraphs.forEach((para) => {
      let textLine = para.trim();
      if (!textLine) return;

      // Handle custom headings within markdown
      let isHeading = false;
      let isBullet = false;
      let fontSize = 8.5;
      let textColor = [51, 65, 85]; // slate-700
      let fontStyle = "normal";

      if (textLine.startsWith("### ")) {
        isHeading = true;
        textLine = textLine.replace("### ", "").replace(/\*\*/g, "");
        fontSize = 10;
        textColor = [79, 70, 229]; // Indigo-600
        fontStyle = "bold";
      } else if (textLine.startsWith("## ")) {
        isHeading = true;
        textLine = textLine.replace("## ", "").replace(/\*\*/g, "");
        fontSize = 11;
        textColor = [15, 23, 42]; // slate-900
        fontStyle = "bold";
      } else if (textLine.startsWith("# ")) {
        isHeading = true;
        textLine = textLine.replace("# ", "").replace(/\*\*/g, "");
        fontSize = 12;
        textColor = [15, 23, 42];
        fontStyle = "bold";
      } else if (textLine.startsWith("- ") || textLine.startsWith("* ")) {
        isBullet = true;
        textLine = textLine.substring(2).replace(/\*\*/g, "");
      } else {
        // Just general paragraph text - strip bold identifiers for clean look
        textLine = textLine.replace(/\*\*/g, "");
      }

      doc.setFont("Helvetica", fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      // Split words gracefully
      const wrappedLines = doc.splitTextToSize(textLine, contentWidth - (isBullet ? 8 : 0));
      
      wrappedLines.forEach((line: string, idx: number) => {
        checkNewPage(4.5);
        if (isBullet && idx === 0) {
          // first line bullet point
          doc.setFont("Helvetica", "bold");
          doc.setTextColor(79, 70, 229);
          doc.text("•", margin + 2, y + 3);
          
          doc.setFont("Helvetica", fontStyle);
          doc.setTextColor(51, 65, 85);
          doc.text(line, margin + 6, y + 3);
        } else if (isBullet) {
          // indent the continuation lines of bullet points
          doc.text(line, margin + 6, y + 3);
        } else {
          doc.text(line, margin, y + 3);
        }
        y += 4.5;
      });

      // extra spacing after paragraph or section heading
      y += isHeading ? 3.5 : 2;
    });
  }

  // Save the constructed document
  const rawCnpj = cnpj.replace(/\D/g, "");
  doc.save(`parecer_trib_rtc_${rawCnpj || "relatorio"}.pdf`);
}

import { useState } from "react";
import { TaxRegime, FiscalDocument, CFOP_LABELS } from "./types";
import { generateReportPDF } from "./utils/pdfGenerator";
import XmlUploader from "./components/XmlUploader";
import { 
  Calculator, 
  Settings, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertTriangle, 
  Activity, 
  Cpu, 
  Download, 
  RefreshCw, 
  HelpCircle, 
  CheckCircle,
  FileText,
  BadgeAlert,
  PieChart,
  Grid,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");
  const [companyName, setCompanyName] = useState("Simples Apuração Comercial Ltda");
  const [regime, setRegime] = useState<TaxRegime>("Simples Nacional");
  
  // Tab control
  const [activeTab, setActiveTab] = useState<"visao" | "simulador" | "xml" | "conformidade" | "ai" | "tutorial">("visao");

  // States for Supplier non-compliance letter
  const [supplierName, setSupplierName] = useState("");
  const [supplierCnpj, setSupplierCnpj] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierDocKey, setSupplierDocKey] = useState("");
  const [supplierDocValue, setSupplierDocValue] = useState("");

  // Global manual/assumed indicators (when no precise XML is present)
  const [totalSales, setTotalSales] = useState<number>(180000);
  const [totalPurchases, setTotalPurchases] = useState<number>(85000);
  
  // Custom Brazilian Reform simulations variables
  const [purchasesFromSimplesRatio, setPurchasesFromSimplesRatio] = useState<number>(45); 
  const [salesToCompaniesRatio, setSalesToCompaniesRatio] = useState<number>(80); 
  
  // Custom option under Reforma: Recolher IBS/CBS "por fora" do Simples
  const [payIbsCbsPorFora, setPayIbsCbsPorFora] = useState<boolean>(false);

  // XML Documents persistence
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);

  // AI Dossier states
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculations & Constants (Reforma Tributária LC 214/2025)
  const ALIQUOTA_PADRAO_IBS = 17.7; 
  const ALIQUOTA_PADRAO_CBS = 8.8;  
  const ALIQUOTA_DUAL_CHEIA = ALIQUOTA_PADRAO_IBS + ALIQUOTA_PADRAO_CBS; // 26.5%

  const SIMPLES_CREDIT_RATE_IBS = 3.5;
  const SIMPLES_CREDIT_RATE_CBS = 2.5;

  const hasDocs = documents.length > 0;

  // Determine actual credits and debits from XMLs or physical estimates
  let calculatedDebitsIbs = 0;
  let calculatedDebitsCbs = 0;
  let calculatedCreditsIbs = 0;
  let calculatedCreditsCbs = 0;

  if (hasDocs) {
    documents.forEach(doc => {
      if (doc.direction === "saida") {
        calculatedDebitsIbs += doc.valIbs;
        calculatedDebitsCbs += doc.valCbs;
      } else {
        calculatedCreditsIbs += doc.valIbs;
        calculatedCreditsCbs += doc.valCbs;
      }
    });
  } else {
    // Computes based on operational assumptions
    const purchasesRpa = totalPurchases * (1 - purchasesFromSimplesRatio / 100);
    const purchasesSimples = totalPurchases * (purchasesFromSimplesRatio / 100);

    calculatedCreditsIbs = (purchasesRpa * (ALIQUOTA_PADRAO_IBS / 100)) + (purchasesSimples * (SIMPLES_CREDIT_RATE_IBS / 100));
    calculatedCreditsCbs = (purchasesRpa * (ALIQUOTA_PADRAO_CBS / 100)) + (purchasesSimples * (SIMPLES_CREDIT_RATE_CBS / 100));

    // Debits derivation
    if (regime === "RPA" || payIbsCbsPorFora) {
      calculatedDebitsIbs = totalSales * (ALIQUOTA_PADRAO_IBS / 100);
      calculatedDebitsCbs = totalSales * (ALIQUOTA_PADRAO_CBS / 100);
    } else {
      const factor = regime === "MEI" ? 0.015 : 0.055; 
      calculatedDebitsIbs = totalSales * (factor * 0.58);
      calculatedDebitsCbs = totalSales * (factor * 0.42);
    }
  }

  const totalCredits = calculatedCreditsIbs + calculatedCreditsCbs;
  const totalDebits = calculatedDebitsIbs + calculatedDebitsCbs;
  const netIbs = Math.max(0, calculatedDebitsIbs - calculatedCreditsIbs);
  const netCbs = Math.max(0, calculatedDebitsCbs - calculatedCreditsCbs);
  const totalNetTax = netIbs + netCbs;

  const currentRevenue = hasDocs ? documents.filter(d => d.direction === "saida").reduce((s, d) => s + d.totalVal, 0) : totalSales;
  const currentCost = hasDocs ? documents.filter(d => d.direction === "entrada").reduce((s, d) => s + d.totalVal, 0) : totalPurchases;

  // B2B client loss calculation if Simples Nacional does not destacan IBS/CBS
  const b2bSalesVolume = currentRevenue * (salesToCompaniesRatio / 100);
  const lostCreditsForClients = payIbsCbsPorFora ? 0 : b2bSalesVolume * (ALIQUOTA_DUAL_CHEIA / 100);

  // Filter non-compliant items starting year 2026/LC 214 rules
  const nonCompliantDocs = documents.filter(doc => {
    // If RPA, and total val is positive, and no IBS/CBS is highlighted in outbound/inbound
    const hasAnyIbsCbs = doc.valIbs > 0 || doc.valCbs > 0;
    return !hasAnyIbsCbs && doc.totalVal > 0;
  });

  // CFOP aggregation groups for visual rendering (both loaded and simulated data)
  interface CfopGroupTotals {
    cfop: string;
    label: string;
    direction: "entrada" | "saida";
    totalVal: number;
    valIbs: number;
    valCbs: number;
    count: number;
  }

  const cfopGroups: CfopGroupTotals[] = (() => {
    const groups: Record<string, CfopGroupTotals> = {};

    if (hasDocs) {
      documents.forEach((doc) => {
        const code = doc.cfop || (doc.direction === "entrada" ? "1102" : "5102");
        const key = `${code}-${doc.direction}`;
        if (!groups[key]) {
          groups[key] = {
            cfop: code,
            label: CFOP_LABELS[code] || (doc.direction === "entrada" ? "Outras Entradas de Material" : "Outras Prestações de Saída"),
            direction: doc.direction,
            totalVal: 0,
            valIbs: 0,
            valCbs: 0,
            count: 0
          };
        }
        groups[key].totalVal += doc.totalVal;
        groups[key].valIbs += doc.valIbs;
        groups[key].valCbs += doc.valCbs;
        groups[key].count += 1;
      });
    } else {
      // Create simulated groupings so user still has rich insight with zero loaded XML documents
      groups["5102-saida"] = {
        cfop: "5102",
        label: CFOP_LABELS["5102"] + " (Simulação)",
        direction: "saida",
        totalVal: totalSales,
        valIbs: calculatedDebitsIbs,
        valCbs: calculatedDebitsCbs,
        count: 1
      };
      
      groups["1102-entrada"] = {
        cfop: "1102",
        label: CFOP_LABELS["1102"] + " (Simulação)",
        direction: "entrada",
        totalVal: totalPurchases,
        valIbs: calculatedCreditsIbs,
        valCbs: calculatedCreditsCbs,
        count: 1
      };
    }

    return Object.values(groups).sort((a, b) => {
      if (a.direction !== b.direction) {
        return a.direction === "entrada" ? -1 : 1; // entries first
      }
      return a.cfop.localeCompare(b.cfop);
    });
  })();

  // Handle CVS/data report export
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Chave,Origem,Destino,Tipo,CFOP,Fluxo,Valor Total (R$),IBS (R$),CBS (R$),Descricao\n";
    
    const rows = hasDocs ? documents : [
      {
        id: "Sim_1",
        chave: "SimuladoGeralFaturamento",
        emitente: companyName,
        destinatario: "Clientes Gerais",
        type: "NF-e",
        direction: "saida",
        totalVal: currentRevenue,
        valIbs: calculatedDebitsIbs,
        valCbs: calculatedDebitsCbs,
        description: "Faturamento simulado de saídas",
        cfop: "5102"
      } as any,
      {
        id: "Sim_2",
        chave: "SimuladoGeralCompras",
        emitente: "Fornecedores Gerais",
        destinatario: companyName,
        type: "NF-e",
        direction: "entrada",
        totalVal: currentCost,
        valIbs: calculatedCreditsIbs,
        valCbs: calculatedCreditsCbs,
        description: "Insumos operacionais simulados",
        cfop: "1102"
      } as any
    ];

    rows.forEach(r => {
      const code = r.cfop || (r.direction === "entrada" ? "1102" : "5102");
      csvContent += `"${r.id}","${r.chave}","${r.emitente || r.emit_name || ''}","${r.destinatario || r.dest_name || ''}","${r.type}","${code}","${r.direction}",${r.totalVal},${r.valIbs},${r.valCbs},"${r.description || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `apuracao_rtc_${cnpj.replace(/\D/g, "") || "relatorio"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    generateReportPDF({
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
      documents,
      cfopGroups,
      aiAnalysis
    });
  };

  const requestAiAnalysis = async () => {
    setLoadingAi(true);
    setAiAnalysis(null);
    setErrorMessage(null);

    const payload = {
      regime,
      totalPurchases: currentCost,
      totalSales: currentRevenue,
      purchasesFromSimplesCount: Math.round((purchasesFromSimplesRatio / 100) * 10),
      salesToCompaniesCount: Math.round((salesToCompaniesRatio / 100) * 10),
      documents: documents.map(d => ({
        type: d.type,
        direction: d.direction,
        valIbs: d.valIbs,
        valCbs: d.valCbs,
        totalVal: d.totalVal
      }))
    };

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        setAiAnalysis(data.text);
      } else {
        setErrorMessage(data.error || "Erro de servidor ao compilar diagnóstico Gemini.");
      }
    } catch (err: any) {
      setErrorMessage("Erro ao conectar com a Inteligência Fiscal. Teste se o servidor está ativo.");
    } finally {
      setLoadingAi(false);
    }
  };

  const parseMarkdownToJsx = (text: string) => {
    if (!text) return null;
    return text.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return <h4 key={idx} className="text-sm font-bold text-slate-100 mt-4 mb-1.5 font-sans flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-indigo-400 shrink-0" /> {trimmed.replace("###", "")}</h4>;
      }
      if (trimmed.startsWith("##")) {
        return <h3 key={idx} className="text-base font-bold text-teal-300 mt-5 border-b border-slate-800 pb-1.5 mb-3 font-sans">{trimmed.replace("##", "")}</h3>;
      }
      if (trimmed.startsWith("#")) {
        return <h2 key={idx} className="text-lg font-extrabold text-white mt-5 mb-4 font-sans">{trimmed.replace("#", "")}</h2>;
      }
      if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
        const itemText = trimmed.substring(1).trim();
        return (
          <li key={idx} className="text-slate-300 text-xs leading-relaxed ml-4 list-disc my-1.5">
            {formatBoldText(itemText)}
          </li>
        );
      }
      return <p key={idx} className="text-slate-300 text-xs leading-relaxed my-2">{formatBoldText(trimmed)}</p>;
    });
  };

  const formatBoldText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-white font-medium bg-indigo-950/40 px-1 py-0.5 rounded text-[11px]">{part}</strong> : part));
  };

  return (
    <div id="main-app-container" className="bg-[#0b0f19] text-slate-100 min-h-screen font-sans selection:bg-indigo-500 selection:text-white">
      {/* Dynamic top badge representing production deployment readiness */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 px-4 py-1.5 text-center text-[11px] font-mono tracking-wider text-indigo-200 border-b border-indigo-900/60 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-400" />
        <span>CONFORMIDADE LEGAL LC 214/2025 ATIVADA • APURAÇÃO ASSISTIDA POR IA COGNITIVA</span>
      </div>

      {/* Top Premium Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0d1222]/95 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white font-sans">Simples Apuração RTC</h1>
                <span className="bg-emerald-950 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                  SaaS Beta v3.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Harmonização Inteligente de Créditos e Débitos na Transição IBS/CBS</p>
            </div>
          </div>

          {/* Quick Actions & Navigation tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Exportar Balanço CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              Imprimir Relatório
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-md shadow-indigo-950/40 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-100" />
              Download Parecer PDF
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Dynamic MicroSaaS Global metrics ribbon */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-[#101526] border border-slate-800/60 p-4 rounded-xl">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Empresa Analisada</p>
            <p className="text-xs font-bold text-slate-200 mt-1 truncate">{companyName || "Simulado"}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{cnpj}</p>
          </div>
          <div className="bg-[#101526] border border-slate-800/60 p-4 rounded-xl">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Enquadramento</p>
            <span className="inline-block mt-1 bg-indigo-950 text-indigo-400 border border-indigo-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded">
              {regime} {payIbsCbsPorFora && "+ Highlight"}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">Regime pretendido para 2026</p>
          </div>
          <div className="bg-[#101526] border border-slate-800/60 p-4 rounded-xl">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Faturamento Saídas</p>
            <p className="text-xs font-mono font-bold text-slate-100 mt-1">
              R$ {currentRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] text-slate-500">{hasDocs ? "Dos XMLs importados" : "Configurado no painel"}</span>
          </div>
          <div className="bg-[#101526] border border-slate-800/60 p-4 rounded-xl font-mono">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Crédito Acumulado</p>
            <p className="text-xs font-bold text-emerald-400 mt-1">
              R$ {totalCredits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] text-emerald-600/90 font-sans">Aproveitamento efetivo</span>
          </div>
          <div className="bg-[#101526] border border-slate-800/60 p-4 rounded-xl font-mono">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">IBS + CBS Líquido</p>
            <p className="text-xs font-bold text-red-400 mt-1">
              R$ {totalNetTax.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] text-slate-500 font-sans">Saldo a pagar estimado</span>
          </div>
        </section>

        {/* Tab Selection Navigation */}
        <div className="border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {[
              { id: "visao", label: "Visão Geral da Apuração", icon: Activity },
              { id: "simulador", label: "Simulador de Parâmetros", icon: TrendingUp },
              { id: "xml", label: "Análise de XMLs Fiscais", icon: FileText },
              { id: "conformidade", label: "Filtro de Inconformidades", icon: AlertTriangle },
              { id: "ai", label: "Dossiê Inteligente AI", icon: Cpu },
              { id: "tutorial", label: "Tutorial de Uso", icon: HelpCircle },
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition shrink-0 whitespace-nowrap cursor-pointer ${
                    isSelected 
                      ? "border-indigo-500 text-indigo-400 bg-indigo-950/20" 
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-400">{documents.length}</span> documentos carregados
          </div>
        </div>

        {/* Tab Contents with AnimatePresence */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {/* Traw 1: Visão Geral */}
            {activeTab === "visao" && (
              <motion.div
                key="visao"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left core parameters summaries */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-[#10162a]/90 border border-slate-800/80 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Settings className="w-4.5 h-4.5 text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Diagnóstico Cadastral</h3>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium font-mono">RAZÃO SOCIAL</label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full mt-1 px-3 py-1.5 bg-slate-900/60 text-xs text-slate-200 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium font-mono">CNPJ DA OPERAÇÃO</label>
                          <input
                            type="text"
                            value={cnpj}
                            onChange={(e) => setCnpj(e.target.value)}
                            className="w-full mt-1 px-3 py-1.5 bg-slate-900/60 text-xs text-slate-200 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium font-mono">REGIME DE ENQUADRAMENTO</label>
                          <div className="grid grid-cols-3 gap-1 mt-1">
                            {(["RPA", "Simples Nacional", "MEI"] as TaxRegime[]).map((r) => (
                              <button
                                key={r}
                                onClick={() => {
                                  setRegime(r);
                                  if (r !== "Simples Nacional") setPayIbsCbsPorFora(false);
                                }}
                                className={`py-1.5 text-[10px] font-bold rounded-md border transition ${
                                  regime === r
                                    ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/80"
                                    : "bg-slate-900/40 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>

                        {regime === "Simples Nacional" && (
                          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                            <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                              <input
                                type="checkbox"
                                checked={payIbsCbsPorFora}
                                onChange={(e) => setPayIbsCbsPorFora(e.target.checked)}
                                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                              />
                              <div className="space-y-0.5">
                                <span className="font-semibold text-indigo-300">Recolher IBS/CBS "por fora"</span>
                                <p className="text-[10px] text-slate-400">Garante creditamento integral de 26,5% aos adquirentes do mercado corporativo (B2B).</p>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#10162a]/90 border border-slate-800/80 p-5 rounded-2xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                        <span className="text-xs uppercase font-bold text-slate-400">Origem de Créditos</span>
                        <span className="bg-slate-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-indigo-400">Mapeamento</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> RPA (Lucro Presumido/Real)
                          </span>
                          <span className="font-mono text-slate-200">Aproveita 100% (26,5%)</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Simples Nacional Fornecedor
                          </span>
                          <span className="font-mono text-amber-500">Parcial unificado (~6.0%)</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Fornecedor MEI
                          </span>
                          <span className="font-mono text-rose-400">Crédito zero ou irrisório</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational indicators, charts and status */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-[#10162a]/90 border border-slate-800/80 p-6 rounded-2xl space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                          <Activity className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
                          Resultado de Apuração Dual (IBS/CBS)
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">Consolidado em {cnpj}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Débito Estimado</span>
                          <p className="text-lg font-mono font-bold text-slate-200 mt-1">
                            R$ {totalDebits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <div className="mt-1 text-[9px] text-slate-500 space-y-0.5 font-mono">
                            <p>IBS Saída: R$ {calculatedDebitsIbs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                            <p>CBS Saída: R$ {calculatedDebitsCbs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Crédito Admitido</span>
                          <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
                            R$ {totalCredits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <div className="mt-1 text-[9px] text-emerald-600 space-y-0.5 font-mono">
                            <p>IBS Crédito: R$ {calculatedCreditsIbs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                            <p>CBS Crédito: R$ {calculatedCreditsCbs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        <div className="p-4 bg-indigo-950/10 border border-indigo-500/20 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-indigo-400">Imposto Líquido Devido</span>
                          <p className="text-lg font-mono font-bold text-indigo-300 mt-1">
                            R$ {totalNetTax.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">
                            Carga operacional de {currentRevenue > 0 ? ((totalNetTax / currentRevenue) * 100).toFixed(2) : "0.00"}% do faturamento.
                          </p>
                        </div>
                      </div>

                      {/* Interactive Visual Bar representation */}
                      <div className="p-4 bg-slate-950 rounded-xl space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center text-[11px] text-slate-300">
                          <span>Fluxo de Caixa (Débito vs Crédito)</span>
                          <span className="text-slate-400">Índice: {currentRevenue > 0 ? ((totalCredits / (totalDebits || 1)) * 100).toFixed(1) : "0.0"}% de compensação</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-indigo-500 h-full transition-all" 
                            style={{ width: `${Math.max(5, Math.min(95, (totalDebits / ((totalDebits + totalCredits) || 1)) * 100))}%` }} 
                          />
                          <div 
                            className="bg-emerald-500 h-full transition-all" 
                            style={{ width: `${Math.max(5, Math.min(95, (totalCredits / ((totalDebits + totalCredits) || 1)) * 100))}%` }} 
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-sans">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 rounded" /> Débitos (Consumidor/Escopo)</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded" /> Créditos de Fornecedores</span>
                        </div>
                      </div>
                    </div>

                    {/* Simples Nacional warning */}
                    {regime === "Simples Nacional" && !payIbsCbsPorFora && (
                      <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex gap-3">
                        <BadgeAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-amber-300">Análise de Risco Comercial para Cluintes RPA</h4>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Pessoas jurídicas sujeitas ao regime de débito e crédito perderão aproximadamente <strong>R$ {lostCreditsForClients.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> em créditos caso comprem de você sem o destaque opcional do IBS/CBS por fora.
                          </p>
                          <div className="pt-1.5 flex gap-2">
                            <button
                              onClick={() => {
                                setPayIbsCbsPorFora(true);
                                setActiveTab("simulador");
                              }}
                              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/30 text-amber-200 px-2 py-0.5 rounded transition font-semibold"
                            >
                              Estudar destaque de impostos por fora
                            </button>
                            <button
                              onClick={() => setActiveTab("ai")}
                              className="text-[10px] text-slate-400 hover:text-slate-200 transition font-medium"
                            >
                              Verificar parecer da IA →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CFOP BREAKDOWN SECTION */}
                <div className="bg-[#10162a]/90 border border-slate-800/80 p-6 rounded-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
                        Apuração e Consolidação de Entrada/Saída por CFOP
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Valores agregados por Código Fiscal de Operações e Prestações (Requisito Fiscal SEFAZ)
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-900/35">
                          <th className="py-2.5 px-3 font-semibold text-slate-300">CFOP</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-300">Tipo / Fluxo</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-300">Descrição Fiscal</th>
                          <th className="py-2.5 px-3 font-semibold text-center text-slate-300">Docs</th>
                          <th className="py-2.5 px-3 font-semibold text-right text-slate-300">Valor Total</th>
                          <th className="py-2.5 px-3 font-semibold text-right text-slate-300">IBS Apurado</th>
                          <th className="py-2.5 px-3 font-semibold text-right text-slate-300">CBS Apurado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {cfopGroups.map((group) => (
                          <tr key={`${group.cfop}-${group.direction}`} className="hover:bg-slate-900/30 transition">
                            <td className="py-3 px-3 font-mono font-bold text-slate-100">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${
                                group.direction === "entrada" 
                                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-blue-950/60 text-blue-400 border border-blue-500/20"
                              }`}>
                                {group.cfop}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold uppercase text-[10px]">
                              {group.direction === "entrada" ? (
                                <span className="text-emerald-400">Entrada (Compra)</span>
                              ) : (
                                <span className="text-indigo-400">Saída (Venda)</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-300 max-w-xs md:max-w-none truncate">
                              {group.label}
                            </td>
                            <td className="py-3 px-3 text-slate-400 font-mono text-center">
                              {group.count}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-200 font-semibold">
                              R$ {group.totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-500/90">
                              R$ {group.valIbs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-teal-400/90">
                              R$ {group.valCbs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Cards by CFOP */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl font-sans flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-emerald-400">Total de Entradas (Compra) por CFOP</span>
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono">CRÉDITO</span>
                        </div>
                        <p className="text-xl font-mono font-bold text-emerald-300 mt-2">
                          R$ {cfopGroups.filter(g => g.direction === "entrada").reduce((sum, g) => sum + g.totalVal, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-sans">Soma de todos os insumos operacionais e mercadorias adquiridas agrupados por CFOP.</p>
                      </div>

                      {/* Total de Entradas por Tipo de Documento */}
                      <div className="mt-4 pt-3 border-t border-emerald-500/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total de Entradas por Tipo de Documento</p>
                        <div className="grid grid-cols-2 gap-2">
                          {["NF-e", "NFC-e", "CT-e", "NFS-e"].map((t) => {
                            const docsOfType = documents.filter(d => d.direction === "entrada" && d.type === t);
                            const totalVal = docsOfType.reduce((s, d) => s + d.totalVal, 0);
                            const count = docsOfType.length;
                            return (
                              <div key={t} className="p-2 bg-slate-900/60 border border-slate-800 rounded-lg">
                                <p className="text-[9px] font-bold text-slate-400">{t}</p>
                                <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                                  R$ {totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[8px] text-slate-500 mt-0.5 font-mono">{count} doc(s)</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-950/10 border border-indigo-500/20 rounded-xl font-sans flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-indigo-400">Total de Saídas (Venda) por CFOP</span>
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded font-mono">DÉBITO</span>
                        </div>
                        <p className="text-xl font-mono font-bold text-indigo-300 mt-2">
                          R$ {cfopGroups.filter(g => g.direction === "saida").reduce((sum, g) => sum + g.totalVal, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Soma de todas as vendas e prestações de serviço agrupadas por CFOP.</p>
                      </div>

                      {/* Total de Saídas por Tipo de Documento */}
                      <div className="mt-4 pt-3 border-t border-indigo-500/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total de Saídas por Tipo de Documento</p>
                        <div className="grid grid-cols-2 gap-2">
                          {["NF-e", "NFC-e", "CT-e", "NFS-e"].map((t) => {
                            const docsOfType = documents.filter(d => d.direction === "saida" && d.type === t);
                            const totalVal = docsOfType.reduce((s, d) => s + d.totalVal, 0);
                            const count = docsOfType.length;
                            return (
                              <div key={t} className="p-2 bg-slate-900/60 border border-slate-800 rounded-lg">
                                <p className="text-[9px] font-bold text-slate-400">{t}</p>
                                <p className="text-xs font-bold text-indigo-400 font-mono mt-0.5">
                                  R$ {totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[8px] text-slate-500 mt-0.5 font-mono">{count} doc(s)</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 2: Simulador */}
            {activeTab === "simulador" && (
              <motion.div
                key="simulador"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-[#10162a]/90 border border-slate-800/80 p-6 rounded-2xl space-y-6"
              >
                <div>
                  <h3 className="text-base font-extrabold text-white">Simulador Proativo de Transição Tributária</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Define variáveis operacionais para estimar a carga sob a Reforma Tributária (LC 214/2025) sem dependência exclusiva de arquivos XML.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">Faturamento Mensal Estimado de Saídas</span>
                        <strong className="font-mono text-indigo-400">R$ {totalSales.toLocaleString("pt-BR")}</strong>
                      </div>
                      <input
                        type="range"
                        min="10000"
                        max="1500000"
                        step="10000"
                        value={totalSales}
                        onChange={(e) => setTotalSales(Number(e.target.value))}
                        disabled={hasDocs}
                        className="w-full mt-2.5 accent-indigo-500 cursor-pointer disabled:opacity-40"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Alíquota Dual Cheia incidente: 26.5% no Regime Normal.</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">Volume de Compras / Insumos tributados</span>
                        <strong className="font-mono text-teal-400">R$ {totalPurchases.toLocaleString("pt-BR")}</strong>
                      </div>
                      <input
                        type="range"
                        min="5000"
                        max="1000000"
                        step="5000"
                        value={totalPurchases}
                        onChange={(e) => setTotalPurchases(Number(e.target.value))}
                        disabled={hasDocs}
                        className="w-full mt-2.5 accent-teal-500 cursor-pointer disabled:opacity-40"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Gera créditos que abatem do imposto devido conforme cadeia de fornecedores.</p>
                    </div>

                    {hasDocs && (
                      <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-amber-200 text-xs">
                        ⚠️ <strong>Modo XML Ativo:</strong> Como você possui arquivos XMLs carregados, estes estimadores estão temporariamente ignorados na apuração oficial. Exclua os documentos na aba XML para simular cenários livremente.
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">% de Compras de fornecedores do Simples Nacional</span>
                        <strong className="font-mono text-amber-500">{purchasesFromSimplesRatio}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={purchasesFromSimplesRatio}
                        onChange={(e) => setPurchasesFromSimplesRatio(Number(e.target.value))}
                        className="w-full mt-2.5 accent-amber-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Insumos vindos de optantes do Simples geram apenas ~6% de crédito, elevando seu imposto devido.
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">% de Vendas destinadas a empresas RPA (B2B)</span>
                        <strong className="font-mono text-blue-400">{salesToCompaniesRatio}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={salesToCompaniesRatio}
                        onChange={(e) => setSalesToCompaniesRatio(Number(e.target.value))}
                        className="w-full mt-2.5 accent-blue-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Mede a dependência comercial corporativa, onde a falta de destaque de IBS/CBS afeta seus clientes.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 3: XML Parser repository */}
            {activeTab === "xml" && (
              <motion.div
                key="xml"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-[#10162a]/95 border border-slate-800/80 p-6 rounded-2xl"
              >
                <XmlUploader 
                  documents={documents} 
                  onDocumentsChange={setDocuments} 
                  myCnpj={cnpj}
                />
              </motion.div>
            )}

            {/* Tab 4: Conformity & CFOP classification */}
            {activeTab === "conformidade" && (
              <motion.div
                key="conformidade"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Intro banner */}
                <div className="bg-[#10162a]/90 border border-slate-800/80 p-6 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-1.5">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        Portal de Inconformidades & Notificação de Fornecedores
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Identifique notas de fornecedores RPA sem destaque dos tributos IBS e CBS regulados pela LC 214/2025. Gere notificações extrajudiciais instantâneas exigindo o preenchimento correto das tags fiscais para garantir seus créditos de 26,5%.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Non-compliant list & Input Form */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* List of non-compliant invoices parsed from XML */}
                    <div className="bg-[#10162a]/90 border border-slate-800/80 p-4 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Notas Fiscais Avaliadas com Alíquota Omitida
                      </p>
                      
                      {nonCompliantDocs.length === 0 ? (
                        <div className="p-6 border border-dashed border-slate-800 rounded-lg text-center space-y-1 bg-slate-900/15">
                          <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto" />
                          <p className="text-[11px] text-slate-300 font-medium">Nenhuma inconformidade no lote atual</p>
                          <p className="text-[9px] text-slate-500">Todos os documentos analisados no regime RPA apresentam destaque de impostos.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {nonCompliantDocs.map((doc, idx) => (
                            <div 
                              key={doc.id || idx} 
                              className="p-2.5 text-[11px] bg-slate-950/40 border border-slate-800 hover:border-indigo-500/40 rounded-lg flex justify-between items-center transition gap-2"
                            >
                              <div className="space-y-0.5 truncate">
                                <p className="font-bold text-slate-200 truncate">{doc.emitente}</p>
                                <p className="text-[9px] text-slate-500 font-mono truncate">Chave: {doc.chave.slice(0, 12)}...{doc.chave.slice(-10)}</p>
                                <p className="text-[9px] text-amber-400 font-mono">Simulado: R$ {doc.totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setSupplierName(doc.emitente);
                                  setSupplierCnpj(doc.emitCnpj || "20.123.456/0001-00");
                                  setSupplierDocKey(doc.chave);
                                  setSupplierDocValue(doc.totalVal.toFixed(2));
                                }}
                                className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 rounded border border-indigo-500/20 text-[9px] font-bold shrink-0 transition"
                              >
                                Preencher Carta
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notification fields form */}
                    <div className="bg-[#10162a]/90 border border-slate-800/80 p-5 rounded-xl space-y-4">
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Campos de Notificação do Fornecedor
                      </p>

                      <div className="space-y-3 font-sans">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome / Razão Social do Fornecedor</label>
                          <input 
                            type="text"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            placeholder="Ex: Fornecedor de Insumos Industriais S.A."
                            className="w-full text-xs bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CNPJ do Fornecedor</label>
                            <input 
                              type="text"
                              value={supplierCnpj}
                              onChange={(e) => setSupplierCnpj(e.target.value)}
                              placeholder="00.000.000/0000-00"
                              className="w-full text-xs font-mono bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail do Fornecedor</label>
                            <input 
                              type="email"
                              value={supplierEmail}
                              onChange={(e) => setSupplierEmail(e.target.value)}
                              placeholder="fiscal@fornecedor.com.br"
                              className="w-full text-xs bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chave de Acesso / Nota</label>
                            <input 
                              type="text"
                              value={supplierDocKey}
                              onChange={(e) => setSupplierDocKey(e.target.value)}
                              placeholder="Chave NF-e de 44 dígitos"
                              className="w-full text-xs font-mono bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor Total (R$)</label>
                            <input 
                              type="text"
                              value={supplierDocValue}
                              onChange={(e) => setSupplierDocValue(e.target.value)}
                              placeholder="Ex: 1545.90"
                              className="w-full text-xs font-mono bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Default fillers banner if nothing entered */}
                      {!supplierName && (
                        <p className="text-[10px] text-slate-500 italic">
                          Dica: Clique no botão "Preencher Carta" em uma nota inconformada acima para carregar as chaves fiscais automaticamente no formulário.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Interactive Letter Preview Sheet & Action Buttons */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Action Panel for Letter */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[11px] font-semibold text-slate-300">
                        Visualização e Ações de Conformação
                      </span>
                      <div className="flex gap-2">
                        {/* Copy button */}
                        <button
                          onClick={() => {
                            const letterEl = document.getElementById("letter-sheet-text");
                            if (letterEl) {
                              navigator.clipboard.writeText(letterEl.innerText);
                              alert("Texto da Carta de Inconformidade copiado com sucesso!");
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-900 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Copiar Texto
                        </button>

                        {/* Send Email button */}
                        <button
                          onClick={() => {
                            const letterEl = document.getElementById("letter-sheet-text");
                            const text = letterEl ? letterEl.innerText : "";
                            const subject = `NOTIFICAÇÃO DE INCONFORMIDADE FISCAL (IBS/CBS) - NF-e ${supplierDocKey || "REFORMA TRIBUTÁRIA"}`;
                            window.open(`mailto:${supplierEmail || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-900 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Enviar por E-mail
                        </button>

                        {/* Print / Save button */}
                        <button
                          onClick={() => {
                            const printWindow = window.open("", "_blank");
                            const letterEl = document.getElementById("letter-sheet-text");
                            if (printWindow && letterEl) {
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Carta de Inconformidade Tributária</title>
                                    <style>
                                      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                                      .letter { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                                      h2 { text-transform: uppercase; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; font-size: 16px; margin-bottom: 25px; }
                                      .meta { margin-bottom: 20px; font-size: 13px; }
                                      p { margin-bottom: 15px; font-size: 13px; }
                                      .point { font-weight: bold; margin-left: 20px; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="letter">
                                      ${letterEl.innerHTML.replace(/\n/g, "<br>")}
                                    </div>
                                    <script>window.print();</script>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir
                        </button>
                      </div>
                    </div>

                    {/* Paper Sheet Rendering */}
                    <div className="bg-white text-slate-800 p-8 rounded-xl shadow-2xl border border-slate-200 font-sans leading-relaxed text-xs overflow-x-auto min-h-[500px]">
                      <div id="letter-sheet-text" className="max-w-2xl mx-auto space-y-4">
                        <div className="text-center font-extrabold text-[13px] text-slate-900 border-b-2 border-indigo-600 pb-3 uppercase tracking-wide">
                          CARTA DE NOTIFICAÇÃO DE INCONFORMIDADE TRIBUTÁRIA (IVA DUAL - IBS/CBS)
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-600 font-sans pb-3">
                          <p><strong>Destinatário:</strong> {supplierName || "___________________________________________"}</p>
                          <p><strong>CNPJ do Fornecedor:</strong> {supplierCnpj || "___________________________"}</p>
                          <p><strong>E-mail Comercial/Fiscal:</strong> <span className={supplierEmail ? "" : "text-slate-400"}>{supplierEmail || "[Preencha o e-mail ou utilize o link acima]"}</span></p>
                          <p><strong>Assunto:</strong> Solicitação urgente de retificação fiscal (Destaque de IBS/CBS - Ano Fiscal 2026+)</p>
                          <p><strong>Referência:</strong> Lei Complementar nº 214/2025 e Reforma Tributária (Emenda Constitucional 132/2023)</p>
                        </div>

                        <p className="text-justify font-sans leading-relaxed text-[11px]">
                          Prezado departamento tributário e faturamento da empresa <strong>{supplierName || "______________________"}</strong>,
                        </p>

                        <p className="text-justify text-[11px] leading-relaxed">
                          Serve a presente notificação extrajudicial para solicitar, em caráter de urgência, a revisão e correção da nota fiscal correspondente à operação identificada pelos dados abaixo indicados:
                        </p>

                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1 text-[11px] font-mono select-all">
                          <p><strong>• Chave de Acesso da Nota:</strong> {supplierDocKey || "________________________________________________"}</p>
                          <p><strong>• Valor Total Declarado:</strong> R$ {supplierDocValue ? parseFloat(supplierDocValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "_________,___"}</p>
                          <p><strong>• Alíquota Dual Esperada:</strong> IBS (17,7%) e CBS (8,8%) - Total de 26,5% de aproveitamento de crédito fiscal</p>
                        </div>

                        <p className="text-justify text-[11px] leading-relaxed">
                          Verificamos por análise de lote no nosso portal que, embora vossa instituição esteja devidamente registrada sob o regime de **Regime Tecnológico de Apuração (RPA - Lucro Real/Presumido)**, o referido documento foi emitido e entregue à nossa organização **sem o destaque legítimo de IBS e CBS** em suas respectivas tags e campos tributários nativos XML.
                        </p>

                        <p className="text-justify text-[11px] leading-relaxed">
                          Conforme os mandamentos tributários trazidos pela **Lei Complementar de Regulamentação da Reforma Tributária (LC 214/2025)**, o fornecedor que não promove o correto destaque do IVA Dual impede a apropriação dos créditos financeiros cumulativos correspondentes previstos na legislação de faturamento. Esta omissão gera grave prejuízo financeiro direto no valor estimado de **R$ {supplierDocValue ? (parseFloat(supplierDocValue) * 0.265).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "_________,___"}** em nossa escrituração consolidada.
                        </p>

                        <p className="text-justify text-[11px] leading-relaxed font-bold">
                          Desta forma, para evitar perdas tributárias que prejudicam nossa colaboração comercial, solicitamos que nos enviem no prazo de até 72 horas úteis:
                        </p>

                        <div className="pl-4 space-y-1.5 text-[11px] text-slate-700">
                          <p>1. Transmissão de <strong>Nota Fiscal Retificadora / de Ajuste</strong> destacando o valor correspondente de IBS e CBS;</p>
                          <p>2. Ou, justificativa devidamente embasada pelo seu setor de conformidade fiscal justificando a incidência de regimes especiais ou imunidade aplicáveis à operação analisada.</p>
                        </div>

                        <p className="text-justify text-[11px] leading-relaxed">
                          Contamos com o vosso profissionalismo fiscal e com a presteza de sempre no ambiente do novo ecossistema tributário brasileiro.
                        </p>

                        <p className="pt-4 text-justify text-[11px]">
                          Atenciosamente,
                        </p>

                        <div className="pt-2 text-[11.5px] font-sans">
                          <p className="font-bold">{companyName}</p>
                          <p className="text-slate-500 font-mono">CNPJ da Empresa Contratante: {cnpj}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 5: AI Dossier */}
            {activeTab === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-gradient-to-br from-[#12182b] to-[#0e1324] border border-indigo-950/50 p-6 rounded-2xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-400" />
                      Dossiê Estratégico AI (Gemini Agent)
                    </h3>
                    <p className="text-xs text-indigo-300">Auditoria cognitiva com base na modelagem integrada da Reforma do Consumo.</p>
                  </div>

                  <button
                    onClick={requestAiAnalysis}
                    disabled={loadingAi}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-indigo-950/40 transition cursor-pointer"
                  >
                    {loadingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Avaliando impactos...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Gerar Parecer Inteligente
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-5 min-h-[220px]">
                  {loadingAi && (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-indigo-405 text-indigo-400 animate-spin" />
                      <p className="text-xs text-slate-300 font-semibold animate-pulse">
                        Estruturando análise tributária dual...
                      </p>
                      <p className="text-[10px] text-slate-500 max-w-sm">
                        O Gemini está avaliando seu regime e contrastando com o perfil competitivo para B2B e o creditamento residual do Simples Nacional.
                      </p>
                    </div>
                  )}

                  {!loadingAi && !aiAnalysis && !errorMessage && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 space-y-3">
                      <HelpCircle className="w-10 h-10 text-slate-700" />
                      <p className="text-xs font-semibold text-slate-400">Nenhum parecer gerado.</p>
                      <p className="text-[10px] text-slate-500 max-w-sm">Clique no botão "Gerar Parecer Inteligente" no topo para submeter faturamentos, XMLs e cadastros à IA do Gemini.</p>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-4 bg-rose-950/30 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
                      {errorMessage}
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="space-y-4">
                      {/* PDF Export Banner */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-indigo-950/40 border border-indigo-500/20 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-indigo-300">Parecer Técnico Fiscal Pronto</p>
                          <p className="text-[10px] text-slate-400">Exportar o diagnóstico do Gemini formatado em PDF para apresentação executiva.</p>
                        </div>
                        <button
                          onClick={handleExportPDF}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-950/50 transition cursor-pointer self-start sm:self-center"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-100" />
                          Exportar Parecer PDF
                        </button>
                      </div>

                      <div className="markdown-body space-y-1 overflow-x-auto text-slate-300 leading-relaxed font-sans prose prose-invert max-w-none">
                        {parseMarkdownToJsx(aiAnalysis)}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab 6: Interactive Tutorial */}
            {activeTab === "tutorial" && (
              <motion.div
                key="tutorial"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Header banner */}
                <div className="bg-gradient-to-r from-slate-900 to-[#101526] border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <HelpCircle className="w-48 h-48 text-indigo-400" />
                  </div>
                  <div className="max-w-2xl space-y-2 relative z-10">
                    <span className="inline-block bg-indigo-950 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-widest">
                      Manual de Operações
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-1.5">
                      Tutorial de Uso - Simples Apuração RTC
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      Entenda como maximizar o uso desta plataforma de inteligência fiscal para simular, auditar, corrigir inconformidades de fornecedores e emitir pareceres estratégicos sobre a Reforma Tributária.
                    </p>
                  </div>
                </div>

                {/* Steps Accordion/Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Step 1 */}
                  <div className="bg-[#10162a]/90 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-mono font-extrabold text-indigo-500/40">01</span>
                      <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">Passo 1: Importar os XMLs</p>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed">
                      Acesse a aba <strong>Análise de XMLs Fiscais</strong> e arraste ou selecione os arquivos XML das suas notas. A plataforma suporta em lote:
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 pl-4 list-disc font-sans">
                      <li><strong>NF-e</strong> (Notas de Mercadorias)</li>
                      <li><strong>NFC-e</strong> (Cupom de Consumidor)</li>
                      <li><strong>CT-e</strong> (Conhecimento de Transporte)</li>
                      <li><strong>NFS-e</strong> (Notas de Serviços de Prefeituras)</li>
                    </ul>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-[#10162a]/90 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-mono font-extrabold text-indigo-500/40">02</span>
                      <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <Settings className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">Passo 2: Configurar Empresa</p>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed">
                      Ajuste os dados cadastrais da sua empresa na barra lateral ou nos painéis superiores para guiar a lógica fiscal:
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 pl-4 list-disc font-sans">
                      <li><strong>Razão Social</strong> e <strong>CNPJ</strong> para que o leitor diferencie automaticamente Entradas (compras) e Saídas (vendas).</li>
                      <li><strong>Regime Tributário</strong> (Simples Nacional vs RPA) para calcular a sua apuração dual de alíquotas.</li>
                    </ul>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-[#10162a]/90 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-mono font-extrabold text-indigo-500/40">03</span>
                      <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">Passo 3: Simular Parâmetros</p>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed">
                      Na aba <strong>Simulador de Parâmetros</strong>, manipule as variáveis para calcular o impacto da reforma que começa em 2026:
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 pl-4 list-disc font-sans">
                      <li>Defina o limite de compras de fornecedores do Simples para ver o efeito da perda de créditos de IBS/CBS.</li>
                      <li>Simule o recolhimento do IVA \"Por Fora\" do Simples Nacional para restaurar competitividade nas vendas B2B.</li>
                    </ul>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-[#10162a]/90 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-mono font-extrabold text-indigo-500/40">04</span>
                      <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">Passo 4: Auditoria de Notas</p>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed">
                      Navegue para a aba <strong>Filtro de Inconformidades</strong>. O sistema filtra automaticamente as notas RPA de entrada que não destacaram IBS (17,7%) ou CBS (8,8%):
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 pl-4 list-disc font-sans">
                      <li>Visualize o valor exato do <strong>crédito fiscal perdido</strong>.</li>
                      <li>Clique em <strong>\"Preencher Carta\"</strong> para carregar os dados de forma instantânea no gerador de notificação.</li>
                    </ul>
                  </div>

                  {/* Step 5 */}
                  <div className="bg-[#10162a]/90 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-mono font-extrabold text-indigo-500/40">05</span>
                      <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">Passo 5: Enviar Notificação</p>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed font-sans">
                      Com os dados do fornecedor carregados ou digitados manualmente:
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 pl-4 list-disc font-sans">
                      <li>Clique em <strong>Copiar Texto</strong> para colar em qualquer ferramenta de chat institucional ou portal fiscal.</li>
                      <li>Use o botão <strong>Enviar por E-mail</strong> para disparar via cliente nativo.</li>
                      <li>Use <strong>Imprimir</strong> para gerar um PDF formal assinado pela diretoria.</li>
                    </ul>
                  </div>

                  {/* Step 6 */}
                  <div className="bg-[#10162a]/90 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-mono font-extrabold text-indigo-500/40">06</span>
                      <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <Cpu className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">Passo 6: Parecer & Exportação</p>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed font-sans">
                      Para gerar a consolidação e fundamentação legal para a junta diretiva:
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 pl-4 list-disc font-sans">
                      <li>Vá até a aba <strong>Dossiê Inteligente AI</strong> e clique em \"Gerar Parecer Inteligente\".</li>
                      <li>Uma análise gerada sob medida pelo Gemini apoiará na tomada de decisão fiscal estratégica.</li>
                      <li>Após gerado, você pode exportar tudo formatado em <strong>PDF Certificado</strong>.</li>
                    </ul>
                  </div>
                </div>

                {/* Direct support or legal tip */}
                <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                  <p className="font-sans text-[11px] leading-normal">
                    <strong>Alerta de Conformidade Legal:</strong> O destaque de IBS e CBS é um direito do adquirente nas operações sujeitas ao regime não-cumulativo da EC 132/2023. O envio da notificação regulariza os saldos credores de insumos industriais de forma diplomática com o faturamento de seus fornecedores parceiros.
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* Footer detailing legal context */}
      <footer className="border-t border-slate-800/80 bg-[#070b13] py-8 px-6 text-center text-slate-500 text-[11px] mt-16 font-mono space-y-1">
        <p>Simples Apuração RTC — Licenciado sob a Lei Complementar nº 214/2025 para finalidade exclusiva de simulação fiscal e adensamento cognitivo.</p>
        <p className="mt-1">Google AI Studio Build &copy; {new Date().getFullYear()} — Ativo em contêineres segregados seguros de alto desempenho.</p>
      </footer>
    </div>
  );
}

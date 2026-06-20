import React, { useState, useRef, useEffect } from "react";
import { FiscalDocument, CFOP_LABELS } from "../types";
import { Upload, FileText, CheckCircle2, ChevronRight, Play, AlertCircle, PlusCircle, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";

interface XmlUploaderProps {
  documents: FiscalDocument[];
  onDocumentsChange: (docs: FiscalDocument[]) => void;
  myCnpj: string;
}

// 5 default realistic Brazilian XML simulation files
const COMPILADO_EXEMPLOS: FiscalDocument[] = [
  {
    id: "doc_1",
    chave: "35260645189230000109550010001248591029384756",
    emit_name: "Metalúrgica São Paulo S.A. (RPA)",
    dest_name: "Simples Apuração Comercial Ltda (Minha Empresa)",
    emit: "45.189.230/0001-09",
    dest: "12.345.678/0001-90",
    type: "NF-e",
    direction: "entrada",
    totalVal: 15400.00,
    valIbs: 2725.80, // 17.7% of 15400
    valCbs: 1355.20, // 8.8% of 15400
    rateIbs: 17.7,
    rateCbs: 8.8,
    description: "Insulmos e chapas de aço carbono para fabricação",
    cfop: "1102"
  } as any,
  {
    id: "doc_2",
    chave: "33260655189230000155660010005432101029384751",
    emit_name: "Papelaria do Sol EIRELI (Simples)",
    dest_name: "Simples Apuração Comercial Ltda (Minha Empresa)",
    emit: "55.189.230/0001-55",
    dest: "12.345.678/0001-90",
    type: "NF-e",
    direction: "entrada",
    totalVal: 2200.00,
    valIbs: 132.00, // Reduced Simples credit - e.g. 6% unified (3.5% IBS, 2.5% CBS)
    valCbs: 88.00,
    rateIbs: 6.0,
    rateCbs: 4.0,
    description: "Materiais de escritório diversos",
    cfop: "1556"
  } as any,
  {
    id: "doc_3",
    chave: "35260612345678000190550010000123451029384752",
    emit_name: "Simples Apuração Comercial Ltda (Minha Empresa)",
    dest_name: "Supermercados Estrela S.A. (RPA Cliente)",
    emit: "12.345.678/0001-90",
    dest: "02.771.552/0001-22",
    type: "NF-e",
    direction: "saida",
    totalVal: 25000.00,
    valIbs: 4425.00, // 17.7%
    valCbs: 2200.00, // 8.8%
    rateIbs: 17.7,
    rateCbs: 8.8,
    description: "Venda de mercadorias manufaturadas B2B",
    cfop: "5102"
  } as any,
  {
    id: "doc_4",
    chave: "35260612345678000190550010000123461029384753",
    emit_name: "Simples Apuração Comercial Ltda (Minha Empresa)",
    dest_name: "Consumidor Final CPF",
    emit: "12.345.678/0001-90",
    dest: "333.444.555-66",
    type: "NFC-e",
    direction: "saida",
    totalVal: 780.00,
    valIbs: 138.06, // 17.7%
    valCbs: 68.64,  // 8.8%
    rateIbs: 17.7,
    rateCbs: 8.8,
    description: "Venda direta varejo B2C",
    cfop: "5102"
  } as any,
  {
    id: "doc_5",
    chave: "35260635129034000199570010000045611029384754",
    emit_name: "Rápido Transbrasil Transportes S.A.",
    dest_name: "Simples Apuração Comercial Ltda (Minha Empresa)",
    emit: "35.129.034/0001-99",
    dest: "12.345.678/0001-90",
    type: "CT-e",
    direction: "entrada",
    totalVal: 3400.00,
    valIbs: 601.80, // 17.7%
    valCbs: 299.20, // 8.8%
    rateIbs: 17.7,
    rateCbs: 8.8,
    description: "Frete interestadual sobre chapas de aço",
    cfop: "2352"
  } as any,
];

export default function XmlUploader({ documents, onDocumentsChange, myCnpj }: XmlUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [filter, setFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual fast document input fields
  const [manualType, setManualType] = useState<"NF-e" | "NFC-e" | "CT-e" | "NFS-e">("NF-e");
  const [manualDirection, setManualDirection] = useState<"entrada" | "saida">("entrada");
  const [manualVal, setManualVal] = useState("");
  const [manualEmit, setManualEmit] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualCfop, setManualCfop] = useState("1102");

  // Keep CFOP in sync with direction unless altered by user
  useEffect(() => {
    setManualCfop(manualDirection === "entrada" ? "1102" : "5102");
  }, [manualDirection]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseXmlString = (xmlText: string, filename: string): FiscalDocument => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check for parse error
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error("Arquivo XML inválido ou mal formatado.");
    }

    // Extraction parsing
    let emitName = xmlDoc.getElementsByTagName("emit")[0]?.getElementsByTagName("xNome")[0]?.textContent || "Emitente Desconhecido";
    let destName = xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("xNome")[0]?.textContent || "Consumidor Final";
    let emitCnpj = xmlDoc.getElementsByTagName("emit")[0]?.getElementsByTagName("CNPJ")[0]?.textContent || "00.000.000/0001-00";
    let destCnpj = xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("CNPJ")[0]?.textContent || 
                  xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("CPF")[0]?.textContent || "333.333.333-33";
    
    // Key/Chave
    let infProt = xmlDoc.getElementsByTagName("infProt")[0];
    let key = infProt?.getElementsByTagName("chNFe")[0]?.textContent || 
              xmlDoc.getElementsByTagName("infNFe")[0]?.getAttribute("Id")?.replace("NFe", "") || 
              Math.random().toString().substring(2, 46);

    // Total value
    let totalValNode = xmlDoc.getElementsByTagName("vNF")[0] || xmlDoc.getElementsByTagName("vProd")[0] || xmlDoc.getElementsByTagName("vServ")[0];
    let totalVal = totalValNode ? Number(totalValNode.textContent || 0) : 1000.00;

    // CFOP Extraction (done early to reliably determine direction)
    let cfopNode = xmlDoc.getElementsByTagName("CFOP")[0] || xmlDoc.getElementsByTagName("cfop")[0];
    let cfop = cfopNode?.textContent ? cfopNode.textContent.trim() : "";
    if (cfop.length > 4) {
      cfop = cfop.slice(0, 4);
    }

    // Detect direction based on CFOP prefix if available (Standard Brazilian Tax Rules)
    // 5xxx, 6xxx, 7xxx = "saida" (Débitos)
    // 1xxx, 2xxx, 3xxx = "entrada" (Créditos)
    let direction: "entrada" | "saida" = "entrada";
    if (cfop) {
      const firstDigit = cfop.charAt(0);
      if (["5", "6", "7"].includes(firstDigit)) {
        direction = "saida";
      } else if (["1", "2", "3"].includes(firstDigit)) {
        direction = "entrada";
      } else {
        // Fallback to CNPJ comparison
        const cleanedMyCnpj = myCnpj.replace(/\D/g, "");
        const cleanedEmitCnpj = emitCnpj.replace(/\D/g, "");
        if (cleanedEmitCnpj === cleanedMyCnpj) {
          direction = "saida";
        }
      }
    } else {
      // Fallback to CNPJ matching
      const cleanedMyCnpj = myCnpj.replace(/\D/g, "");
      const cleanedEmitCnpj = emitCnpj.replace(/\D/g, "");
      if (cleanedEmitCnpj === cleanedMyCnpj) {
        direction = "saida";
      }
      cfop = direction === "entrada" ? "1102" : "5102";
    }

    // Subtag values for IBS/CBS
    // Look for tags <vIBS> and <vCBS>
    let vIbsNode = xmlDoc.getElementsByTagName("vIBS")[0];
    let vCbsNode = xmlDoc.getElementsByTagName("vCBS")[0];
    let rateIbsNode = xmlDoc.getElementsByTagName("pIBS")[0];
    let rateCbsNode = xmlDoc.getElementsByTagName("pCBS")[0];

    let valIbs = vIbsNode ? Number(vIbsNode.textContent || 0) : 0;
    let valCbs = vCbsNode ? Number(vCbsNode.textContent || 0) : 0;
    let rateIbs = rateIbsNode ? Number(rateIbsNode.textContent || 0) : 17.7;
    let rateCbs = rateCbsNode ? Number(rateCbsNode.textContent || 0) : 8.8;

    // If no direct IBS/CBS tags exist, apply simulated RTC estimations (transition simulator)
    if (valIbs === 0 && valCbs === 0) {
      // RPA default is alíquota padrão 17.7% e 8.8%
      valIbs = Number((totalVal * 0.177).toFixed(2));
      valCbs = Number((totalVal * 0.088).toFixed(2));
    }

    // Document types
    let docType: "NF-e" | "NFC-e" | "CT-e" | "NFS-e" = "NF-e";
    if (filename.toLowerCase().includes("ct")) docType = "CT-e";
    if (filename.toLowerCase().includes("nfc")) docType = "NFC-e";
    if (filename.toLowerCase().includes("nfs") || filename.toLowerCase().includes("servico")) docType = "NFS-e";

    return {
      id: Math.random().toString(36).substring(7),
      chave: key,
      emitente: emitName,
      destinatario: destName,
      type: docType,
      direction,
      totalVal,
      valIbs,
      valCbs,
      rateIbs,
      rateCbs,
      description: `Documento importado via parser XML (${filename})`,
      cfop,
      emitCnpj,
      destCnpj
    };
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setUploadError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const processFiles = async (files: FileList) => {
    const newDocs: FiscalDocument[] = [];
    const errors: string[] = [];

    const handleXmlText = (text: string, filename: string) => {
      try {
        const parsedDoc = parseXmlString(text, filename);
        newDocs.push(parsedDoc);
      } catch (err: any) {
        errors.push(`Falha ao ler o arquivo "${filename}": ${err.message}`);
      }
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isZip = file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";

      if (isZip) {
        try {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          const zipFilesKeys = Object.keys(loadedZip.files);
          let xmlCountInZip = 0;

          for (const relativePath of zipFilesKeys) {
            const zipEntry = loadedZip.files[relativePath];
            // Skip directory entries
            if (zipEntry.dir) continue;

            if (zipEntry.name.toLowerCase().endsWith(".xml")) {
              xmlCountInZip++;
              const xmlContent = await zipEntry.async("string");
              handleXmlText(xmlContent, zipEntry.name);
            }
          }

          if (xmlCountInZip === 0) {
            errors.push(`O pacote ZIP "${file.name}" não continha nenhum arquivo *.xml correspondente.`);
          }
        } catch (err: any) {
          errors.push(`Erro de processamento no ZIP "${file.name}": ${err.message}`);
        }
      } else if (file.type === "text/xml" || file.name.endsWith(".xml")) {
        try {
          const text = await file.text();
          handleXmlText(text, file.name);
        } catch (err: any) {
          errors.push(`Falha ao ler "${file.name}": ${err.message}`);
        }
      } else {
        errors.push(`Arquivo "${file.name}" não é um formato suportado (*.xml ou *.zip).`);
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join(" | "));
    }

    if (newDocs.length > 0) {
      onDocumentsChange([...documents, ...newDocs]);
    }
  };

  const loadPresetDataset = () => {
    onDocumentsChange(COMPILADO_EXEMPLOS);
    setUploadError(null);
  };

  const addManualDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVal || isNaN(Number(manualVal))) {
      setUploadError("Por favor, informe um valor numérico válido.");
      return;
    }

    const val = Number(manualVal);
    // Calculated mock IBS 17.7% / CBS 8.8%
    const isEntrada = manualDirection === "entrada";
    const rateI = 17.7;
    const rateC = 8.8;
    const parsedIbs = Number((val * (rateI / 100)).toFixed(2));
    const parsedCbs = Number((val * (rateC / 100)).toFixed(2));

    const newDoc: FiscalDocument = {
      id: Math.random().toString(36).substring(7),
      chave: Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join(""),
      emitente: isEntrada ? (manualEmit || "Emitente Fornecedor S.A.") : "Simples Apuração Comercial Ltda (Minha Empresa)",
      destinatario: isEntrada ? "Simples Apuração Comercial Ltda (Minha Empresa)" : (manualEmit || "Cliente Corporativo Ltda"),
      type: manualType,
      direction: manualDirection,
      totalVal: val,
      valIbs: parsedIbs,
      valCbs: parsedCbs,
      rateIbs: rateI,
      rateCbs: rateC,
      description: manualDesc || "Lançamento tributário manual",
      cfop: manualCfop || (isEntrada ? "1102" : "5102")
    };

    onDocumentsChange([...documents, newDoc]);
    setManualVal("");
    setManualEmit("");
    setManualDesc("");
    setUploadError(null);
  };

  const removeDoc = (id: string) => {
    onDocumentsChange(documents.filter(d => d.id !== id));
  };

  const clearAll = () => {
    onDocumentsChange([]);
  };

  const filteredDocs = documents.filter((d) => {
    if (filter === "todos") return true;
    return d.direction === filter;
  });

  const totalXmlVal = documents.reduce((sum, d) => sum + d.totalVal, 0);
  const totalIbsVal = documents.reduce((sum, d) => sum + d.valIbs, 0);
  const totalCbsVal = documents.reduce((sum, d) => sum + d.valCbs, 0);

  return (
    <div id="xml-uploader-root" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-100 tracking-tight">
            1. Repositório e Parser de Documentos Fiscais
          </h2>
          <p className="text-sm text-slate-400">
            Adicione notas fiscais reais em XML (NF-e, NFC-e, CT-e), simule registros de transição para o novo regime CBS/IBS ou faça o upload de um lote compactado em arquivo ZIP contendo diversos XMLs de apuração.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadPresetDataset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 rounded-lg text-indigo-200 transition font-medium"
          >
            <Play className="w-3.5 h-3.5" />
            Carregar Exemplo Realista
          </button>
          {documents.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 rounded-lg text-rose-200 transition font-medium"
            >
              Excluir Tudo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload box & manual entry */}
        <div className="lg:col-span-1 space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition ${
              dragActive
                ? "border-indigo-400 bg-indigo-950/30"
                : "border-slate-700 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xml,.zip"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-3 bg-slate-800/80 rounded-lg text-indigo-400 mb-3 border border-slate-700">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-200">Arraste XMLs ou arquivos ZIP aqui</p>
            <p className="text-xs text-slate-500 mt-1">Aceita arquivos *.xml individuais ou empacotados em *.zip</p>
          </div>

          {uploadError && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Manual Entry Form */}
          <form onSubmit={addManualDocument} className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Lançamento Rápido</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-medium">Segmento</label>
                <select
                  value={manualType}
                  onChange={(e: any) => setManualType(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="NF-e">NF-e (Mercadorias)</option>
                  <option value="NFC-e">NFC-e (Consumidor)</option>
                  <option value="CT-e">CT-e (Transporte)</option>
                  <option value="NFS-e">NFS-e (Serviços)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-medium">Fluxo Fiscal</label>
                <select
                  value={manualDirection}
                  onChange={(e: any) => setManualDirection(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="entrada">Entrada (Compra)</option>
                  <option value="saida">Saída (Venda)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-medium font-mono">CÓDIGO CFOP</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ex. 1102"
                  value={manualCfop}
                  onChange={(e) => setManualCfop(e.target.value.replace(/\D/g, ""))}
                  required
                  className="w-full mt-1 px-2.5 py-1.5 bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500 font-mono font-bold tracking-wider text-indigo-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-medium">VALOR TOTAL (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex. 1500.00"
                  value={manualVal}
                  onChange={(e) => setManualVal(e.target.value)}
                  required
                  className="w-full mt-1 px-2.5 py-1.5 bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-medium">Nome do Parceiro</label>
                <input
                  type="text"
                  placeholder="Ex. Fornecedor ABC"
                  value={manualEmit}
                  onChange={(e) => setManualEmit(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-medium">Descrição Item</label>
                <input
                  type="text"
                  placeholder="Ex. Matéria Prima"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs text-white rounded font-medium transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Inserir Documento
            </button>
          </form>
        </div>

        {/* Database records view */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Metrics display */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/40 p-3 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Documentos</span>
              <p className="text-xl font-mono font-bold text-slate-200">{documents.length}</p>
            </div>
            <div className="bg-slate-900/40 p-3 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Valor Total</span>
              <p className="text-sm font-mono font-bold text-slate-200 mt-1">
                R$ {totalXmlVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-slate-900/40 p-3 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">IBS + CBS Extrapolado</span>
              <p className="text-sm font-mono font-bold font-sans text-emerald-400 mt-1">
                R$ {(totalIbsVal + totalCbsVal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            {/* Filter bar */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setFilter("todos")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    filter === "todos" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilter("entrada")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    filter === "entrada" ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Entradas (Créditos)
                </button>
                <button
                  onClick={() => setFilter("saida")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    filter === "saida" ? "bg-blue-950/40 text-blue-300 border border-blue-500/20" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Saídas (Débitos)
                </button>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                {filteredDocs.length} exibidos
              </span>
            </div>

            {/* Invoices List */}
            <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-800/80">
              <AnimatePresence initial={false}>
                {filteredDocs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Nenhum documento cadastrado. Importe arquivos XML ou adicione manualmente acima.
                  </div>
                ) : (
                  filteredDocs.map((doc, idx) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.15 }}
                      className="p-3.5 hover:bg-slate-900/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-center group"
                    >
                      <div className="md:col-span-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase ${
                            doc.direction === "entrada"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                              : "bg-blue-950 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {doc.direction === "entrada" ? "Crédito" : "Débito"}
                        </span>
                      </div>
                      <div className="md:col-span-4 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 truncate">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">
                            {doc.direction === "entrada" ? doc.emitente : doc.destinatario}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-mono">
                          Chave: {doc.chave.substring(0, 10)}...{doc.chave.substring(doc.chave.length - 8)} | {doc.type}
                        </span>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-[10px] font-medium text-slate-400 block truncate">
                          Ref: {doc.description || "Insumo operacional"}
                        </span>
                        <div className="mt-1 flex items-center">
                          <span className="inline-block text-[9px] font-mono font-bold bg-slate-800/80 text-indigo-300 px-2 py-0.5 rounded border border-slate-700">
                            CFOP {doc.cfop || (doc.direction === "entrada" ? "1102" : "5102")}
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-3 font-mono text-right text-xs">
                        <div className="text-slate-300 font-semibold">
                          R$ {doc.totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          IBS: R$ {doc.valIbs.toFixed(2)} ({doc.rateIbs}%) | CBS: R$ {doc.valCbs.toFixed(2)} ({doc.rateCbs}%)
                        </div>
                      </div>

                      <div className="md:col-span-2 text-right">
                        <button
                          onClick={() => removeDoc(doc.id)}
                          className="text-slate-600 hover:text-rose-400 p-1.5 rounded bg-slate-800/20 hover:bg-rose-950/30 transition opacity-80 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

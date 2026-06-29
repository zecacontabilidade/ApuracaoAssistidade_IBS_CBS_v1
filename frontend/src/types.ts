export type TaxRegime = "RPA" | "Simples Nacional" | "MEI";

export interface FiscalDocument {
  id: string;
  chave: string;
  emitente: string;
  destinatario: string;
  type: "NF-e" | "NFC-e" | "CT-e" | "NFS-e";
  direction: "entrada" | "saida"; // entrada = compra (crédito), saida = venda (débito)
  totalVal: number;
  valIbs: number;
  valCbs: number;
  rateIbs: number;
  rateCbs: number;
  description: string;
  cfop?: string; // Código Fiscal de Operações e Prestações (e.g. 5102, 1102)
  emitCnpj?: string;
  destCnpj?: string;
}

export interface SimulationState {
  regime: TaxRegime;
  totalPurchases: number;
  totalSales: number;
  purchasesFromSimplesRatio: number; // percentage of purchases that are from Simples Nacional (credits are reduced)
  salesToCompaniesRatio: number; // percentage of sales that are B2B to companies in RPA (they demand credit)
}

export const CFOP_LABELS: Record<string, string> = {
  // Entradas (1xxx e 2xxx)
  "1101": "Compra para industrialização (Estado)",
  "2101": "Compra para industrialização (Outro Estado)",
  "1102": "Compra para comercialização (Estado)",
  "2102": "Compra para comercialização (Outro Estado)",
  "1556": "Compra para uso ou consumo (Estado)",
  "2556": "Compra para uso ou consumo (Outro Estado)",
  "1933": "Aquisição de serviço de transporte (Estado)",
  "2933": "Aquisição de serviço de transporte (Outro Estado)",
  "1352": "Aquisição de serviço de transporte p/ industrialização",
  "2352": "Aquisição de faturamento de frete/transporte p/ indústria",
  "1403": "Compra de mercadoria com Substituição Tributária",
  
  // Saídas (5xxx e 6xxx)
  "5101": "Venda de produção do estabelecimento (Estado)",
  "6101": "Venda de produção do estabelecimento (Outro Estado)",
  "5102": "Venda de mercadoria adquirida de terceiros (Estado)",
  "6102": "Venda de mercadoria adquirida de terceiros (Outro Estado)",
  "5405": "Venda de mercadoria ST (Substituto Tributário)",
  "5933": "Prestação de serviço tributado pelo ISS/municipal",
  "6933": "Prestação de serviço interestadual",
};

export interface CfopGroupTotals {
  cfop: string;
  label: string;
  direction: "entrada" | "saida";
  totalVal: number;
  valIbs: number;
  valCbs: number;
  count: number;
}


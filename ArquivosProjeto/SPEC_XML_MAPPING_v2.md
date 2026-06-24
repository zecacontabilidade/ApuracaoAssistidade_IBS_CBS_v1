# SPEC — Mapeamento XML → Modelo de Domínio (v2)
## Os 4 Tipos de Documento Fiscal — Revisado
> Versão: 2.0 | Data: 2026-06-01
> Revisões: Lógica CFOP corrigida; NFS-e migrada para padrão nacional (DPS/SNNFSe)

---

## CORREÇÃO FUNDAMENTAL: LÓGICA DE CRÉDITO E DÉBITO

### O modelo mental correto

A determinação de crédito ou débito de IBS/CBS **não é dirigida pelo CFOP**. O CFOP cumpre um papel secundário e específico: **filtrar operações não-comerciais** (brindes, remessas, amostras) que não geram obrigação tributária. Fora isso, o CFOP é irrelevante para a lógica de apuração.

O **único driver** de crédito ou débito é a **direção inferida** (INBOUND/OUTBOUND), que por sua vez é determinada pela **posição do CNPJ analisado** na operação:

```
Mesma nota, mesmo CFOP 5.102:

Perspectiva do EMITENTE (OUTBOUND):
  → Está saindo mercadoria/serviço do seu patrimônio
  → Está gerando DÉBITO de IBS/CBS

Perspectiva do DESTINATÁRIO (INBOUND):
  → Está RECEBENDO o insumo
  → Está gerando CRÉDITO de IBS/CBS

O CFOP 5.102 não muda. A posição relativa ao CNPJ analisado é que define o impacto.
```

### O papel real do CFOP na ferramenta

O CFOP serve apenas para **excluir da análise de conformidade** as operações que, por sua natureza, não geram obrigação de destaque de IBS/CBS:

- Remessas para conserto/reparo (5.915)
- Brindes e amostras (5.910, 5.911)  
- Remessas para industrialização por conta de terceiros (5.901)
- Exportações (7.xxx) — imunes

Para todas as demais operações, a regra é simples:
- INBOUND + vIBS/vCBS > 0 → **CRÉDITO**
- OUTBOUND + vIBS/vCBS > 0 → **DÉBITO**
- INBOUND ou OUTBOUND + vIBS/vCBS = 0 (regime RPA, operação comercial) → **INCONFORMIDADE**

### Simplificação do TaxAnalyzerService

A lógica atual de `cfop_category` (SALE, RETURN, TRANSFER, OTHER) pode ser simplificada. O que realmente importa:

```
enrichItem(item, direction):
  → isExcluded(cfop) ? rtc_impact = NEUTRAL
  → direction === INBOUND ? rtc_impact = CREDIT
  → direction === OUTBOUND ? rtc_impact = DEBIT
  → direction === UNKNOWN ? rtc_impact = NEUTRAL
```

A categorização CFOP pode permanecer como metadado informativo (útil na exportação Excel), mas não deve mais ser o critério de impacto RTC.

---

## CONVENÇÕES

- `[obrig]` — campo obrigatório no XML válido
- `[cond]` — presente em determinadas situações
- `[reform]` — campo IBS/CBS introduzido pela Reforma Tributária
- Namespace da NFS-e Nacional: `http://www.sped.fazenda.gov.br/nfse`

---

## PARTE 1 — NF-e — Modelo 55

### Origem e raiz XML
```
nfeProc > NFe > infNFe     (XML com protocolo de autorização — mais comum)
NFe > infNFe               (XML avulso sem protocolo)
```

### Identificação no DocumentDetector
```
Regex primária: /<nfeProc/i ou /<NFe[^S]/i
Extração de modNF: /<mod>55<\/mod>/
```

### Campos Cabeçalho

| Caminho XML | Modelo | Obs |
|---|---|---|
| `infNFe[@Id]` → remove "NFe" | `access_key` | 44 dígitos |
| `infNFe[@versao]` | `version` | "4.00" |
| `infNFe.ide.dhEmi` | `issue_date` | ISO 8601 |
| `infNFe.ide.finNFe` | `purpose` | 1=NORMAL 2=COMPLEMENTAR 3=AJUSTE 4=DEVOLUCAO |
| `infNFe.emit.CNPJ` | `issuer.cnpj_cpf` | [obrig] |
| `infNFe.emit.xNome` | `issuer.name` | [obrig] |
| `infNFe.emit.enderEmit.UF` | `issuer.uf` | [obrig] |
| `infNFe.emit.CRT` | `tax_regime` | 1/2=SIMPLES_NACIONAL 3=RPA |
| `infNFe.dest.CNPJ` ou `.CPF` | `receiver.cnpj_cpf` | [obrig ou cond] |
| `infNFe.dest.xNome` | `receiver.name` | [obrig] |
| `infNFe.dest.enderDest.UF` | `receiver.uf` | [cond] |

### Campos Totais

| Caminho XML | Modelo |
|---|---|
| `total.ICMSTot.vProd` | `totals.vProd` |
| `total.ICMSTot.vDesc` | `totals.vDesc` |
| `total.ICMSTot.vFrete` | `totals.vFrete` |
| `total.ICMSTot.vTotTrib` | `totals.vTotTrib` |
| `total.ICMSTot.vICMS` | `totals.vICMS` |
| `total.ICMSTot.vPIS` | `totals.vPIS` |
| `total.ICMSTot.vCOFINS` | `totals.vCOFINS` |
| `total.ICMSTot.vNF` | `total_value` |
| `total.IBSCBSTot.vBCIBSCBS` | `totals.vBCIBSCBS` [reform][cond] |
| `total.IBSCBSTot.gIBS.vIBS` | `totals.vIBS` [reform][cond] |
| `total.IBSCBSTot.gCBS.vCBS` | `totals.vCBS` [reform][cond] |

### Campos por Item (det[])

| Caminho XML | Modelo |
|---|---|
| `det[@nItem]` | `item_number` |
| `det.prod.xProd` | `description` |
| `det.prod.CFOP` | `cfop` (metadado informativo) |
| `det.prod.NCM` | `ncm` |
| `det.prod.vProd` | `gross_value` |
| `det.prod.vDesc` | `discount_value` |
| `det.imposto.ICMS.*` (primeiro filho) | `taxes_current.icms_*` |
| `det.imposto.PIS.*` (primeiro filho) | `taxes_current.pis_*` |
| `det.imposto.COFINS.*` (primeiro filho) | `taxes_current.cofins_*` |
| `det.imposto.IPI.IPITrib` | `taxes_current.ipi_*` [cond] |
| `det.imposto.IBSCBS.CST` | `rtc.cst` [reform][cond] |
| `det.imposto.IBSCBS.cClassTrib` | `rtc.c_class_trib` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.vBC` | `rtc.vBC` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.gIBSUF.pIBSUF` | `rtc.pIBSUF` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.gIBSUF.vIBSUF` | `rtc.vIBSUF` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.gIBSMun.pIBSMun` | `rtc.pIBSMun` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.gIBSMun.vIBSMun` | `rtc.vIBSMun` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.vIBS` | `rtc.vIBS` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.gCBS.pCBS` | `rtc.pCBS` [reform][cond] |
| `det.imposto.IBSCBS.gIBSCBS.gCBS.vCBS` | `rtc.vCBS` [reform][cond] |

### Armadilhas conhecidas
- Array `det`: forçar com `isArray` no fast-xml-parser
- ICMS tem múltiplos grupos (`ICMS00`, `ICMS20`, `ICMSSN500`...): usar `Object.values()[0]`
- PIS/COFINS com tributação por quantidade (`PISQtde`): base em unidade, não valor — tratar separadamente
- Campos IBSCBS ausentes = correto em documentos de 2024/2025

---

## PARTE 2 — NFC-e — Modelo 65

### Natureza
A NFC-e é estruturalmente **idêntica à NF-e** ao nível de XSD. O mesmo schema 4.00 serve ambos. A diferença está em regras de negócio, não em estrutura XML.

### Identificação no DocumentDetector
```
Regex primária: /<nfeProc/i ou /<NFe[^S]/i (igual à NF-e)
Diferenciação: /<mod>65<\/mod>/
→ Resultado: document_type = 'NFCE'
```

### Diferenças em relação à NF-e (55)

| Aspecto | NF-e (55) | NFC-e (65) |
|---|---|---|
| `ide.mod` | 55 | **65** |
| Destinatário | Obrigatório | Opcional |
| CFOPs | Qualquer | Somente 5.xxx (internas) |
| IPI | Condicional | Nunca presente |
| Finalidade | 1, 2, 3, 4 | Sempre 1 (NORMAL) |
| Sentido | Entrada ou Saída | Sempre Saída (do emitente) |

### Tratamento do destinatário ausente
```
Se infNFe.dest não existe ou dest.CNPJ/CPF ausente:
  receiver = { cnpj_cpf: 'CONSUMIDOR_FINAL', name: 'CONSUMIDOR FINAL' }
```

### Impacto na apuração RTC
NFC-e **sempre é OUTBOUND** do ponto de vista do emitente (único que emite). Se o CNPJ analisado é o emitente → DÉBITO. Se o CNPJ analisado é o consumidor → não aplicável (consumidor final não se credita).

### Implementação
Parser: **reaproveitar o ParserNFe** integralmente. Adicionar no `parse()`:
1. Ler `ide.mod` (ou `ide.modNF`) para setar `document_type`
2. Tornar o nó `dest` opcional com fallback

---

## PARTE 3 — CT-e — Modelo 57

### Origem e raiz XML
```
cteProc > CTe > infCte     (com protocolo)
CTe > infCte               (avulso)
```

### Identificação
```
Regex: /<cteProc/i ou /<CTe[^O]/i
Não precisa verificar mod (CT-e não tem ambiguidade de modelo)
```

### Campos Cabeçalho

| Caminho XML | Modelo | Obs |
|---|---|---|
| `infCte[@Id]` → remove "CTe" | `access_key` | 44 dígitos |
| `infCte[@versao]` | `version` | "3.00" |
| `infCte.ide.dhEmi` | `issue_date` | |
| `infCte.ide.CFOP` | `cfop` (nível doc) | CFOP único do serviço de transporte |
| `infCte.ide.finCTe` | `purpose` | 0=NORMAL 1=COMPLEMENTAR 2=ANULACAO 3=SUBSTITUTO |
| `infCte.emit.CNPJ` | `issuer.cnpj_cpf` | Transportadora |
| `infCte.emit.CRT` | `tax_regime` | |
| `infCte.rem.CNPJ/CPF` | `sender.cnpj_cpf` | Remetente [cond] |
| `infCte.dest.CNPJ/CPF` | `receiver.cnpj_cpf` | Destinatário |

### Valor e Tributos — Nível Documento

| Caminho XML | Modelo |
|---|---|
| `infCte.vPrest.vTPrest` | `total_value` |
| `infCte.imp.ICMS.*` (primeiro filho) | tributos nível doc |
| `infCte.imp.vTotTrib` | `totals.vTotTrib` |
| `infCte.imp.IBSCBS.gIBSCBS.vBC` | `totals.vBCIBSCBS` [reform][cond] |
| `infCte.imp.IBSCBS.gIBSCBS.vIBS` | `totals.vIBS` [reform][cond] |
| `infCte.imp.IBSCBS.gIBSCBS.gCBS.vCBS` | `totals.vCBS` [reform][cond] |

### Componentes do Frete (itens do CT-e)

```
infCte.vPrest.Comp[] → items[]
  Comp[n].xNome  → item.description   ("Frete", "Ad Valorem", "Pedágio", etc.)
  Comp[n].vComp  → item.gross_value
  CFOP do IDE    → item.cfop          (mesmo para todos os componentes)
  NCM            → 'N/A'              (serviço, sem NCM)
```

### Posicionamento dos Tributos nos Itens

Os tributos do CT-e são do **documento inteiro**, não de cada componente. A decisão de design:

- `items[0]` (primeiro componente): recebe os campos `taxes_current` e `rtc` com os valores do documento
- `items[1..N]` (demais componentes): `taxes_current = {}`, `rtc = {}`
- Nos totais do documento (`FiscalDocument.totals`): valores completos sempre disponíveis

Comunicação ao usuário na UI: exibir um aviso no modal de CT-e informando que os tributos são do documento total, não do componente específico.

### Chaves NF-e Referenciadas
```
infCte.infCTeNorm.infDoc.infNFe[n].chave → referenced_keys[]
```
Forçar array com `isArray: (name) => name === 'infNFe'`

### Apuração RTC do CT-e
A direção do CT-e é determinada pela mesma lógica: quem é o CNPJ analisado?
- Se a empresa é o **destinatário do frete** (receiver) → INBOUND → CRÉDITO do IBS/CBS
- Se a empresa é a **transportadora emissora** → OUTBOUND → DÉBITO

---

## PARTE 4 — NFS-e Nacional (DPS/SNNFSe)

### Por que o padrão nacional e não o ABRASF?

O Sistema Nacional de NFS-e (SNNFSe), gerido pelo CGNFS-e (RFB + municípios), é o padrão atual de produção (vigente desde outubro de 2025 — schema `v1.01-20260209`). Ele:
1. Tem um único XML unificado — sem variações municipais
2. **Já inclui os campos IBS/CBS** no nó `tribFed` — alinhado à Reforma
3. É o padrão que municípios aderentes estão adotando
4. Referência de esquemas XSD: `NFSe-ESQUEMAS_XSD-v1.01-20260209.zip` em gov.br/nfse

NFS-e no padrão ABRASF antigo → **fora do escopo**. Se o sistema detectar um XML que parece NFS-e mas não for do padrão nacional → retornar UNKNOWN com log explicativo.

### Estrutura XML — NFS-e Nacional

```
NFSe (namespace: http://www.sped.fazenda.gov.br/nfse, versao="1.00")
└── infNFSe [Id="NFSe{chave}"]
    ├── nNFSe           → número sequencial da nota
    ├── cLocEmi         → IBGE code do município emissor  
    ├── dhEmi           → data/hora emissão
    ├── tpEmit          → 1=PJ, 2=PF, 3=Ente Público
    └── DPS             → Documento de Prestação de Serviço
        └── infDPS
            ├── prest   → Prestador (quem presta o serviço)
            │   ├── CNPJ / CPF
            │   ├── IM          → Inscrição Municipal
            │   ├── xNome
            │   └── regTrib
            │       ├── opSimpNac  → 0=Não optante 1=MEI 2=SN 3=SN-excesso
            │       └── porte
            ├── toma    → Tomador (quem contrata o serviço)
            │   ├── CNPJ / CPF
            │   ├── xNome
            │   └── end
            ├── serv    → Serviço
            │   ├── locPrest.cLocPrestacao → IBGE code do município de prestação
            │   ├── cServ
            │   │   ├── cTribNac  → Código NBS (lista de serviços nacional)
            │   │   ├── cTribMun  → Código tributação municipal
            │   │   └── CNAE
            │   └── xDescServ     → Descrição/discriminação do serviço
            └── valores → Valores e tributos
                ├── vServPrest
                │   ├── vReceb    → Valor total recebido
                │   └── vServ     → Valor do serviço
                ├── vDescCondIncond
                │   ├── vDescIncond   → Desconto incondicional
                │   └── vDescCond     → Desconto condicional
                └── trib            → Tributos
                    ├── tribMun     → ISS Municipal
                    │   └── tribISSQN
                    │       ├── cLocIncid   → Município de incidência
                    │       ├── vBC         → Base de cálculo ISS
                    │       ├── pAliq       → Alíquota ISS (%)
                    │       └── tpRetISSQN  → 1=normal 2=retido 3=substituto
                    ├── tribFed     → Tributos Federais (inclui IBS/CBS)
                    │   ├── IBSCBS        → [reform] Estrutura similar à NF-e
                    │   │   ├── CST       → Código de Situação Tributária
                    │   │   ├── vBC       → Base de cálculo
                    │   │   ├── pIBS      → Alíquota IBS total
                    │   │   ├── vIBS      → Valor IBS total
                    │   │   ├── pCBS      → Alíquota CBS
                    │   │   └── vCBS      → Valor CBS
                    │   └── retTrib       → Retenções federais
                    │       ├── pRetIRRF / vRetIRRF
                    │       ├── pRetPIS  / vRetPIS
                    │       ├── pRetCOFINS / vRetCOFINS
                    │       ├── pRetCSLL / vRetCSLL
                    │       └── vRetINSS
                    └── totTrib     → Totais de tributos
                        ├── vTotTrib
                        ├── vTotTribFed
                        └── vTotTribMun
```

### Identificação no DocumentDetector

```
O padrão nacional usa namespace XML → o fast-xml-parser com configuração padrão pode
ignorar ou incluir o namespace no nome do nó.

Abordagem recomendada para detecção:
  - Regex: /sped\.fazenda\.gov\.br\/nfse/i → NFS-e Nacional
  - Regex: /<NFSe[^:]/i → como alternativa (sem namespace)
  - Regex: /<infNFSe/i → fallback

NÃO identificar como NFS-e:
  - Padrões municipais ABRASF: /<CompNfse/i, /<Nfse>/i sem namespace gov.br
  → Retornar UNKNOWN com log: "Padrão ABRASF não suportado. Use o padrão nacional SNNFSe."
```

### Configuração especial do XMLParser para NFS-e

```javascript
// O namespace precisa ser removido do prefixo dos nós
new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  removeNSPrefix: true,   // ← essencial para remover "nfse:" ou prefixos similares
  isArray: (name) => false
})
```

### Mapeamento de Campos — NFS-e Nacional

| Caminho XML | Modelo | Obs |
|---|---|---|
| `infNFSe[@Id]` → remove "NFSe" | `access_key` | Identificador único da nota |
| `infNFSe.nNFSe` | *(número, metadado)* | Número sequencial |
| `infNFSe.cLocEmi` | `municipality_code` | IBGE, novo campo |
| `infNFSe.dhEmi` | `issue_date` | |
| `infNFSe.DPS.infDPS.prest.CNPJ/CPF` | `issuer.cnpj_cpf` | [obrig] |
| `infNFSe.DPS.infDPS.prest.xNome` | `issuer.name` | |
| `infNFSe.DPS.infDPS.prest.IM` | `issuer.ie` | Inscrição Municipal |
| `infNFSe.DPS.infDPS.prest.regTrib.opSimpNac` | `tax_regime` | 0=RPA 1=MEI 2=SIMPLES 3=SIMPLES_EXCESSO |
| `infNFSe.DPS.infDPS.toma.CNPJ/CPF` | `receiver.cnpj_cpf` | [cond] |
| `infNFSe.DPS.infDPS.toma.xNome` | `receiver.name` | |
| `infNFSe.DPS.infDPS.serv.xDescServ` | `item.description` | |
| `infNFSe.DPS.infDPS.serv.cServ.cTribNac` | `item.cfop` | Código NBS (substitui CFOP) |
| `infNFSe.DPS.infDPS.serv.locPrest.cLocPrestacao` | `municipality_code` | IBGE local de prestação |
| `infNFSe.DPS.infDPS.valores.vServPrest.vServ` | `total_value`, `item.gross_value` | |
| `infNFSe.DPS.infDPS.valores.vDescCondIncond.vDescIncond` | `item.discount_value` | |
| `infNFSe.DPS.infDPS.valores.trib.tribMun.tribISSQN.vBC` | `taxes_current.iss_base` | |
| `infNFSe.DPS.infDPS.valores.trib.tribMun.tribISSQN.pAliq` | `taxes_current.iss_rate` | em % |
| `infNFSe.DPS.infDPS.valores.trib.tribMun.tribISSQN.tpRetISSQN` | `taxes_current.iss_retained` | 2=retido |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.IBSCBS.CST` | `rtc.cst` | [reform][cond] |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.IBSCBS.vBC` | `rtc.vBC` | [reform][cond] |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.IBSCBS.vIBS` | `rtc.vIBS` | [reform][cond] |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.IBSCBS.pCBS` | `rtc.pCBS` | [reform][cond] |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.IBSCBS.vCBS` | `rtc.vCBS` | [reform][cond] |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.retTrib.vRetIRRF` | `taxes_current.ir_value` | |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.retTrib.vRetPIS` | `taxes_current.pis_value` | |
| `infNFSe.DPS.infDPS.valores.trib.tribFed.retTrib.vRetCOFINS` | `taxes_current.cofins_value` | |
| `infNFSe.DPS.infDPS.valores.trib.totTrib.vTotTrib` | `totals.vTotTrib` | |

### Diferenças do IBS/CBS na NFS-e vs NF-e

| Campo | NF-e (item) | NFS-e Nacional |
|---|---|---|
| IBS UF | `pIBSUF`, `vIBSUF` separados | `pIBS`, `vIBS` (total unificado) |
| IBS Municipal | `pIBSMun`, `vIBSMun` separados | incluído em `vIBS` total |
| CBS | `pCBS`, `vCBS` | `pCBS`, `vCBS` (igual) |

A NFS-e não detalha IBS UF vs Municipal separadamente — apenas o total do IBS. Ao mapear, `rtc.vIBSUF` e `rtc.vIBSMun` ficam como `undefined`.

### Natureza do item na NFS-e
A NFS-e representa um único serviço. Estrutura do item gerado:
```
items[0] = {
  item_number: 1,
  description: xDescServ,
  cfop: cTribNac,      // código NBS, não CFOP real
  ncm: cTribMun,       // código tributação municipal, não NCM real
  gross_value: vServ,
  discount_value: vDescIncond,
  net_value: vServ - vDescIncond,
  taxes_current: { iss_*, ir_value, pis_value, cofins_value, ... },
  rtc: { cst, vBC, vIBS, pCBS, vCBS }
}
```

### Apuração RTC da NFS-e
Pela mesma lógica de direção:
- CNPJ analisado = prestador (issuer) → OUTBOUND → DÉBITO CBS/IBS
- CNPJ analisado = tomador (receiver) → INBOUND → CRÉDITO CBS/IBS (se destacado)

---

## PARTE 5 — EXTENSÕES NECESSÁRIAS NO MODELO DE DOMÍNIO

### DocumentType
```typescript
// Adicionar NFCE (já previsto mas não implementado)
type DocumentType = 'NFE' | 'NFCE' | 'CTE' | 'NFSE' | 'UNKNOWN'
```

### TaxRegime
```typescript
// Adicionar MEI (específico da NFS-e Nacional)
type TaxRegime = 'SIMPLES_NACIONAL' | 'MEI' | 'RPA' | 'UNKNOWN'
// Duplicata 'RPA' atual deve ser removida
```

### ItemTaxesCurrent — Novos campos para NFS-e
```typescript
interface ItemTaxesCurrent {
  // Existentes (NF-e/CT-e):
  icms_cst?; icms_base?; icms_rate?; icms_value?
  pis_cst?; pis_base?; pis_rate?; pis_value?
  cofins_cst?; cofins_base?; cofins_rate?; cofins_value?
  ipi_cst?; ipi_base?; ipi_rate?; ipi_value?

  // Novos (NFS-e Nacional):
  iss_base?:     number   // Base de cálculo ISS
  iss_rate?:     number   // Alíquota ISS (%)
  iss_value?:    number   // Valor ISS calculado (derivado: base * rate)
  iss_retained?: boolean  // true se tpRetISSQN = 2
  ir_value?:     number   // IR retido
  csll_value?:   number   // CSLL retida
  inss_value?:   number   // INSS retido
}
```

### FiscalDocument — Campos adicionais
```typescript
interface FiscalDocument {
  // ... existentes ...
  municipality_code?: string  // NFS-e: IBGE do município de prestação
}
```

### DocumentTotals — ISS
```typescript
interface DocumentTotals {
  // ... existentes ...
  vISS?:    number   // NFS-e: ISS total
  vISSRet?: number   // NFS-e: ISS retido
}
```

---

## PARTE 6 — TABELA RESUMO DOS 4 PARSERS

| Aspecto | ParserNFe (55) | ParserNFCe (65) | ParserCTe (57) | ParserNFSe |
|---|---|---|---|---|
| Classe | `ParserNFe` (existente) | `ParserNFe` + flag mod65 | `ParserCTe` (existente) | `ParserNFSe` (nova) |
| Raiz XML | nfeProc/NFe > infNFe | nfeProc/NFe > infNFe | cteProc/CTe > infCte | NFSe > infNFSe > DPS |
| XMLParser config | isArray: det | isArray: det | isArray: Comp, infNFe | removeNSPrefix: true |
| Access Key | Id sem "NFe" | Id sem "NFe" | Id sem "CTe" | Id sem "NFSe" |
| Itens | det[] produtos | det[] produtos | Comp[] componentes | 1 serviço |
| Tributos legados | ICMS+PIS+COFINS+IPI | ICMS+PIS+COFINS | ICMS (doc) | ISS+retenções |
| IBS/CBS RTC | Por item (gIBSCBS) | Por item (gIBSCBS) | Nível doc (gIBSCBS) | tribFed.IBSCBS |
| Regime | CRT 1/2/3 | CRT 1/2/3 | CRT 1/2/3 | opSimpNac 0/1/2/3 |
| Destinatário | Obrigatório | Opcional | Obrigatório | Cond (tomador) |
| CFOP | Por item (4 dígitos) | Por item (5.xxx) | Nível doc | Código NBS |
| NCM | Por item (8 dígitos) | Por item (8 dígitos) | 'N/A' | Código Mun. |
| referenced_keys | — | — | infNFe[].chave | — |


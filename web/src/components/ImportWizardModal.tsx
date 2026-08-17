import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  FileSpreadsheet, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Eye, 
  RefreshCw,
  HelpCircle,
  Hash,
  Cpu,
  User,
  Calendar,
  Award,
  Shirt,
  CreditCard,
  QrCode,
  Users
} from "lucide-react";
import { Participant } from "../types";
import { api } from "../lib/appwrite";

// Campos do Sistema disponíveis para mapeamento
export type TargetField = 
  | "ignore"
  | "bib_number"
  | "chip"
  | "name"
  | "birth_date"
  | "modality"
  | "shirt"
  | "cpf"
  | "sex"
  | "qr_code"
  | "category";

interface TargetFieldOption {
  key: TargetField;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const TARGET_FIELDS: TargetFieldOption[] = [
  { key: "ignore", label: "(Ignorar)", shortLabel: "Ignorar", icon: <X className="w-3.5 h-3.5" />, color: "text-slate-400 bg-slate-800/80 border-slate-700", description: "Não importar esta coluna" },
  { key: "bib_number", label: "Número (Peito)", shortLabel: "Número", icon: <Hash className="w-3.5 h-3.5" />, color: "text-brand-300 bg-brand-500/20 border-brand-500/40", description: "Número de peito oficial do atleta" },
  { key: "chip", label: "Chip RFID / EPC", shortLabel: "Chip", icon: <Cpu className="w-3.5 h-3.5" />, color: "text-purple-300 bg-purple-500/20 border-purple-500/40", description: "Código do transponder RFID/EPC" },
  { key: "name", label: "Nome completo", shortLabel: "Nome", icon: <User className="w-3.5 h-3.5" />, color: "text-emerald-300 bg-emerald-500/20 border-emerald-500/40", description: "Nome do atleta participante" },
  { key: "birth_date", label: "Data de Nascimento", shortLabel: "Nascimento", icon: <Calendar className="w-3.5 h-3.5" />, color: "text-cyan-300 bg-cyan-500/20 border-cyan-500/40", description: "Data de nascimento (DD/MM/AAAA)" },
  { key: "modality", label: "Modalidade / Percurso", shortLabel: "Modalidade", icon: <Award className="w-3.5 h-3.5" />, color: "text-blue-300 bg-blue-500/20 border-blue-500/40", description: "5km, 10km, 21km, 42km, etc." },
  { key: "shirt", label: "Camisa (Tamanho)", shortLabel: "Camisa", icon: <Shirt className="w-3.5 h-3.5" />, color: "text-amber-300 bg-amber-500/20 border-amber-500/40", description: "P, M, G, GG, XG, Baby Look, etc." },
  { key: "cpf", label: "CPF", shortLabel: "CPF", icon: <CreditCard className="w-3.5 h-3.5" />, color: "text-pink-300 bg-pink-500/20 border-pink-500/40", description: "Documento de identificação do atleta" },
  { key: "sex", label: "Sexo / Gênero", shortLabel: "Sexo", icon: <Users className="w-3.5 h-3.5" />, color: "text-indigo-300 bg-indigo-500/20 border-indigo-500/40", description: "M, F, Masculino, Feminino" },
  { key: "qr_code", label: "QR Code / Voucher", shortLabel: "QR Code", icon: <QrCode className="w-3.5 h-3.5" />, color: "text-teal-300 bg-teal-500/20 border-teal-500/40", description: "Código para leitura via scanner / QR" },
  { key: "category", label: "Categoria / Faixa", shortLabel: "Categoria", icon: <Award className="w-3.5 h-3.5" />, color: "text-orange-300 bg-orange-500/20 border-orange-500/40", description: "Geral, 20-29, 30-39, PCD, etc." },
];

interface ImportWizardModalProps {
  workbook: XLSX.WorkBook | null;
  fileName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  workbook,
  fileName,
  onClose,
  onSuccess
}) => {
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(1);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [colIndex: number]: TargetField }>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Inicializa a planilha ao carregar o arquivo
  useEffect(() => {
    if (!workbook || workbook.SheetNames.length === 0) return;
    const firstSheet = workbook.SheetNames[0];
    setSelectedSheet(firstSheet);
  }, [workbook]);

  // Lê os dados brutos da aba selecionada
  useEffect(() => {
    if (!workbook || !selectedSheet) return;
    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) return;

    // Converte para matriz de linhas e colunas brutas
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    setRawRows(matrix);

    if (matrix.length > 0) {
      const headerIdx = Math.max(0, Math.min(headerRowIndex - 1, matrix.length - 1));
      const headers = (matrix[headerIdx] || []).map((h, i) => String(h || `Coluna ${i + 1}`).trim());
      setColumnHeaders(headers);

      // Auto-detecção inteligente das colunas
      const initialMap: { [colIndex: number]: TargetField } = {};
      headers.forEach((h, colIdx) => {
        const clean = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        if (clean.match(/^(num|peito|dorsal|bib|numero|inscricao|cod)/)) {
          initialMap[colIdx] = "bib_number";
        } else if (clean.match(/^(chip|epc|rfid|tag|transponder)/)) {
          initialMap[colIdx] = "chip";
        } else if (clean.match(/^(nome|inscrito|atleta|participante|name|runner)/)) {
          initialMap[colIdx] = "name";
        } else if (clean.match(/(nasc|data.*nasc|birth|aniversario|dt_nasc|dt\.)/)) {
          initialMap[colIdx] = "birth_date";
        } else if (clean.match(/(modalidade|percurso|distancia|corrida|prova|modality|tipo)/)) {
          initialMap[colIdx] = "modality";
        } else if (clean.match(/(camisa|camiseta|tamanho|shirt|tam)/)) {
          initialMap[colIdx] = "shirt";
        } else if (clean.match(/(cpf|documento|doc|identidade|rg)/)) {
          initialMap[colIdx] = "cpf";
        } else if (clean.match(/(sexo|genero|sex)/)) {
          initialMap[colIdx] = "sex";
        } else if (clean.match(/(qr|qrcode|qr_code|voucher|chave)/)) {
          initialMap[colIdx] = "qr_code";
        } else if (clean.match(/(categoria|faixa|cat)/)) {
          initialMap[colIdx] = "category";
        } else {
          initialMap[colIdx] = "ignore";
        }
      });

      setColumnMapping(initialMap);
    }
  }, [workbook, selectedSheet, headerRowIndex]);

  // Linhas de dados para pré-visualização (excluindo linhas de cabeçalho)
  const dataRows = useMemo(() => {
    return rawRows.slice(headerRowIndex);
  }, [rawRows, headerRowIndex]);

  // Formatação de data brasileira segura
  const formatBirthDate = (raw: any): string => {
    if (!raw) return "";
    if (typeof raw === "number" && raw > 1000) {
      try {
        const d = XLSX.SSF.parse_date_code(raw);
        if (d && d.y && d.m && d.d) {
          const dd = String(d.d).padStart(2, "0");
          const mm = String(d.m).padStart(2, "0");
          return `${dd}/${mm}/${d.y}`;
        }
      } catch (e) {}
    }
    const str = String(raw).trim();
    if (str.includes("T")) {
      const parts = str.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (str.includes("-")) {
      const parts = str.split("-");
      if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str.substring(0, 32);
  };

  // Converte as linhas brutas nos objetos Participant usando o mapeamento configurado
  const mappedParticipants = useMemo(() => {
    const results: Array<Omit<Participant, "$id" | "event_id">> = [];

    dataRows.forEach((row, rowIdx) => {
      // Ignora linha se estiver completamente vazia
      if (!row || row.every((c) => c === "" || c === null || c === undefined)) return;

      const obj: any = {
        bib_number: "",
        chip: "",
        name: "",
        birth_date: "",
        modality: "Geral",
        shirt: "M",
        cpf: "",
        sex: "M",
        qr_code: "",
        category: "Geral"
      };

      Object.entries(columnMapping).forEach(([colIdxStr, targetField]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const cellValue = row[colIdx];
        if (cellValue === undefined || cellValue === null || targetField === "ignore") return;

        const valStr = String(cellValue).trim();

        if (targetField === "bib_number") {
          obj.bib_number = valStr;
        } else if (targetField === "chip") {
          obj.chip = valStr.toUpperCase();
        } else if (targetField === "name") {
          obj.name = valStr.toUpperCase();
        } else if (targetField === "birth_date") {
          obj.birth_date = formatBirthDate(cellValue);
        } else if (targetField === "modality") {
          obj.modality = valStr || "Geral";
        } else if (targetField === "shirt") {
          obj.shirt = (valStr || "M").toUpperCase().substring(0, 32);
        } else if (targetField === "cpf") {
          obj.cpf = valStr.substring(0, 32);
        } else if (targetField === "sex") {
          obj.sex = valStr.toUpperCase().substring(0, 1) || "M";
        } else if (targetField === "qr_code") {
          obj.qr_code = valStr.substring(0, 255);
        } else if (targetField === "category") {
          obj.category = valStr || "Geral";
        }
      });

      // Validação de segurança: se não tiver bib_number ou chip, gera fallback ordenado
      if (!obj.bib_number) obj.bib_number = String(rowIdx + 1);
      if (!obj.chip) obj.chip = obj.bib_number;
      if (!obj.name) obj.name = `ATLETA #${obj.bib_number}`;
      if (!obj.qr_code) obj.qr_code = obj.bib_number;

      results.push(obj);
    });

    return results;
  }, [dataRows, columnMapping]);

  // Executa a importação em lote para o Appwrite Cloud
  const handleExecuteImport = async () => {
    if (mappedParticipants.length === 0 || importing) return;
    setImporting(true);
    setImportProgress({ current: 0, total: mappedParticipants.length });

    try {
      const res = await api.batchImportParticipants(mappedParticipants, (curr, tot) => {
        setImportProgress({ current: curr, total: tot });
      });

      if (res.inserted > 0) {
        alert(`Importação concluída com sucesso!\n✓ ${res.inserted} atletas cadastrados no Appwrite Cloud.\n${res.errors > 0 ? `! ${res.errors} registros não puderam ser gravados.` : ""}`);
        onSuccess();
      } else {
        alert(`Atenção: Nenhum atleta foi inserido (${res.errors} erros). Verifique a conexão ou os dados da planilha.`);
      }
    } catch (err: any) {
      console.error("Falha na importação:", err);
      alert(`Erro ao importar para a nuvem: ${err?.message || "Falha de comunicação com o banco de dados."}`);
    } finally {
      setImporting(false);
    }
  };

  if (!workbook) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      
      {/* Modal Card Estilo Sistema de Cronometragem */}
      <div className="glass-card rounded-3xl p-5 sm:p-7 max-w-6xl w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-5 animate-scale-in text-slate-100 relative max-h-[92vh] flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                Importação de Atletas
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {fileName}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clique nos cabeçalhos das colunas para associar os dados aos campos do sistema.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Controles: Abas de Planilhas e Linhas de Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 shrink-0">
          
          {/* Abas de Planilhas (ex: Planilha1, Planilha2) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              Aba do Arquivo:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
              {workbook.SheetNames.map((sheetName) => (
                <button
                  key={sheetName}
                  type="button"
                  onClick={() => setSelectedSheet(sheetName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedSheet === sheetName
                      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {sheetName}
                </button>
              ))}
            </div>
          </div>

          {/* Configuração da Linha de Cabeçalho */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              Linha do cabeçalho:
            </label>
            <input
              type="number"
              min={1}
              max={Math.max(1, rawRows.length)}
              value={headerRowIndex}
              onChange={(e) => setHeaderRowIndex(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold text-center focus:border-brand-500 outline-none"
            />
            <span className="text-xs text-slate-400">
              Total de linhas de dados: <strong className="text-brand-300">{dataRows.length}</strong>
            </span>
          </div>
        </div>

        {/* ÁREA DA TABELA COM CABEÇALHOS INTERATIVOS DE SELEÇÃO */}
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/90 shadow-inner relative">
          <table className="w-full text-left text-xs border-collapse">
            
            {/* Linha 1: Seletores Dropdown Interativos */}
            <thead className="sticky top-0 z-20 bg-slate-900 border-b-2 border-slate-700 shadow-md">
              <tr>
                <th className="px-3 py-3 w-12 text-center text-slate-500 font-mono text-[10px] bg-slate-950 border-r border-slate-800">
                  #
                </th>
                {columnHeaders.map((headerText, colIdx) => {
                  const currentMapping = columnMapping[colIdx] || "ignore";
                  const currentField = TARGET_FIELDS.find((f) => f.key === currentMapping);
                  const isIgnored = currentMapping === "ignore";

                  return (
                    <th
                      key={colIdx}
                      className={`px-3 py-2.5 min-w-[150px] border-r border-slate-800 transition-colors ${
                        isIgnored ? "bg-slate-900/90 text-slate-500" : "bg-slate-800/90"
                      }`}
                    >
                      <div className="space-y-1.5">
                        {/* Dropdown de Associação */}
                        <div className="relative">
                          <select
                            value={currentMapping}
                            onChange={(e) => {
                              const newField = e.target.value as TargetField;
                              setColumnMapping((prev) => ({ ...prev, [colIdx]: newField }));
                            }}
                            className={`w-full text-xs font-bold py-1.5 px-2 rounded-lg border appearance-none cursor-pointer transition-all pr-6 ${
                              currentField?.color || "text-slate-400 bg-slate-800 border-slate-700"
                            }`}
                          >
                            {TARGET_FIELDS.map((opt) => (
                              <option key={opt.key} value={opt.key} className="bg-slate-900 text-slate-200">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            ▼
                          </div>
                        </div>

                        {/* Nome Original da Coluna no Arquivo */}
                        <div className="flex items-center justify-between text-[11px] font-mono px-1">
                          <span className={`truncate max-w-[130px] ${isIgnored ? "text-slate-500 line-through" : "text-slate-300 font-bold"}`} title={headerText}>
                            {headerText}
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Corpo da Tabela: Linhas de Dados */}
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {dataRows.length === 0 ? (
                <tr>
                  <td colSpan={columnHeaders.length + 1} className="text-center py-12 text-slate-500">
                    Nenhuma linha de dados encontrada nesta planilha após o cabeçalho.
                  </td>
                </tr>
              ) : (
                dataRows.slice(0, 50).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-800/40 transition-colors">
                    {/* Número da Linha */}
                    <td className="px-3 py-2 text-center text-slate-500 font-mono text-[10px] bg-slate-950/60 border-r border-slate-800">
                      {rowIdx + 1}
                    </td>

                    {/* Células de Dados */}
                    {columnHeaders.map((_, colIdx) => {
                      const currentMapping = columnMapping[colIdx] || "ignore";
                      const isIgnored = currentMapping === "ignore";
                      const cellValue = row[colIdx];
                      const displayVal = cellValue !== undefined && cellValue !== null ? String(cellValue) : "";

                      return (
                        <td
                          key={colIdx}
                          className={`px-3 py-2 border-r border-slate-800/60 truncate max-w-[180px] ${
                            isIgnored 
                              ? "bg-slate-950/40 text-slate-500" 
                              : "text-slate-200 font-medium"
                          }`}
                          title={displayVal}
                        >
                          {currentMapping === "birth_date" ? formatBirthDate(cellValue) : displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Progresso durante a importação */}
        {importing && (
          <div className="space-y-2 p-4 rounded-2xl bg-brand-950/40 border border-brand-500/30 animate-pulse shrink-0">
            <div className="flex justify-between text-xs text-brand-300 font-bold">
              <span>Importando atletas para o Appwrite Cloud...</span>
              <span>
                {importProgress.current} de {importProgress.total} ({Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Rodapé com Ações (Voltar, Importar, Cancelar) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold">Resumo:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {mappedParticipants.length} Atletas Mapeados
            </span>
            {dataRows.length > 50 && (
              <span className="text-[11px] text-slate-500">
                (Exibindo prévia das primeiras 50 linhas)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={importing || mappedParticipants.length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Importar {mappedParticipants.length} Atletas</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

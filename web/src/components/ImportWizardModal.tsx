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
  Users,
  Lock,
  PlusCircle,
  Link as LinkIcon
} from "lucide-react";
import { Participant, EventItem } from "../types";
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
  existingEvents?: EventItem[];
  activeEventId?: string | null;
  onClose: () => void;
  onSuccess: (event?: EventItem) => void;
}

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  workbook,
  fileName,
  existingEvents = [],
  activeEventId,
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

  // Gestão de Identificação do Evento / Trava Obrigatória
  const defaultEventName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
  const [eventMode, setEventMode] = useState<"new" | "existing">(existingEvents.length > 0 ? "new" : "new");
  const [targetEventName, setTargetEventName] = useState<string>(defaultEventName || "Novo Evento");
  const [targetEventDate, setTargetEventDate] = useState<string>(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });
  const [selectedExistingId, setSelectedExistingId] = useState<string>(activeEventId || (existingEvents[0]?.$id || ""));

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
    const results: Array<Omit<Participant, "$id">> = [];

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

  // Validação do Evento (Trava de Segurança)
  const isEventValid = useMemo(() => {
    if (eventMode === "new") {
      return targetEventName.trim().length > 0;
    }
    return Boolean(selectedExistingId);
  }, [eventMode, targetEventName, selectedExistingId]);

  // Executa a importação em lote para o Appwrite Cloud
  const handleExecuteImport = async () => {
    if (!isEventValid) {
      alert("Por favor, preencha o Nome do Evento antes de importar.");
      return;
    }

    if (mappedParticipants.length === 0 || importing) return;
    setImporting(true);
    setImportProgress({ current: 0, total: mappedParticipants.length });

    try {
      let finalEvent: EventItem;

      // 1. Obter ou Criar o Evento no Appwrite
      if (eventMode === "new") {
        finalEvent = await api.createEvent({
          name: targetEventName.trim(),
          event_date: targetEventDate.trim() || undefined
        });
      } else {
        const found = existingEvents.find((e) => e.$id === selectedExistingId);
        if (found) {
          finalEvent = found;
        } else {
          finalEvent = await api.createEvent({
            name: targetEventName.trim(),
            event_date: targetEventDate.trim() || undefined
          });
        }
      }

      // 2. Importação em lote ultra-rápida (com 25 workers concorrentes)
      const res = await api.batchImportParticipants(
        mappedParticipants,
        finalEvent.$id,
        finalEvent.name,
        (curr, tot) => {
          setImportProgress({ current: curr, total: tot });
        }
      );

      if (res.inserted > 0) {
        alert(
          `Importação concluída com sucesso!\n\n` +
          `🏆 Evento: ${finalEvent.name}\n` +
          `✓ ${res.inserted} atletas vinculados e gravados com alta performance no Appwrite Cloud.\n` +
          `${res.errors > 0 ? `⚠️ ${res.errors} registros tiveram alertas.` : ""}`
        );
        onSuccess(finalEvent);
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
                Importação de Atletas por Evento
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {fileName}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Associe esta tabela a um evento específico para garantir a separação total dos dados e contagens.
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

        {/* SEÇÃO 1: TRAVA OBRIGATÓRIA DE IDENTIFICAÇÃO DO EVENTO */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 border border-brand-500/40 shrink-0 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-brand-400 flex items-center gap-1.5 font-mono">
                <Lock className="w-3.5 h-3.5" /> 1. Identificação Obrigatória do Evento / Prova
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-medium">
                Segregação de Dados
              </span>
            </div>

            {/* Alternar entre Novo Evento ou Existente */}
            {existingEvents.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setEventMode("new")}
                  className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                    eventMode === "new"
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Criar Novo Evento
                </button>
                <button
                  type="button"
                  onClick={() => setEventMode("existing")}
                  className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                    eventMode === "existing"
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Vincular a Existente
                </button>
              </div>
            )}
          </div>

          {eventMode === "new" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Evento / Tabela <span className="text-rose-400">* (Obrigatório)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Meia Maratona de Verão 2026"
                  value={targetEventName}
                  onChange={(e) => setTargetEventName(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:outline-none transition-colors ${
                    !targetEventName.trim()
                      ? "border-rose-500 focus:border-rose-400 shadow-sm shadow-rose-500/20"
                      : "border-slate-700 focus:border-brand-500"
                  }`}
                />
                {!targetEventName.trim() && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Digite o nome do evento para desbloquear a importação.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Data da Prova / Evento
                </label>
                <input
                  type="text"
                  placeholder="Ex: 25/08/2026"
                  value={targetEventDate}
                  onChange={(e) => setTargetEventDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Selecione o Evento Existente <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  {existingEvents.map((ev) => (
                    <option key={ev.$id} value={ev.$id}>
                      {ev.name} {ev.event_date ? `(${ev.event_date})` : ""} - {ev.total_athletes || 0} atletas
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 2: Barra de Controles: Abas de Planilhas e Linhas de Cabeçalho */}
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

          {/* Seletor da Linha de Cabeçalho */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>Linha do Cabeçalho:</span>
              <input
                type="number"
                min={1}
                max={Math.min(20, rawRows.length)}
                value={headerRowIndex}
                onChange={(e) => setHeaderRowIndex(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-mono focus:border-brand-500 focus:outline-none"
              />
            </label>

            <span className="text-xs text-slate-500 font-mono">
              Total de Linhas: <strong className="text-slate-300">{dataRows.length}</strong>
            </span>
          </div>
        </div>

        {/* Tabela Interativa de Mapeamento com Pré-visualização ao Vivo */}
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner relative min-h-[260px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700 shadow-md">
              <tr>
                <th className="p-3 text-center text-slate-500 font-mono w-14 border-r border-slate-800 bg-slate-900/90">
                  #
                </th>
                {columnHeaders.map((headerText, colIdx) => {
                  const currentFieldKey = columnMapping[colIdx] || "ignore";
                  const currentField = TARGET_FIELDS.find((f) => f.key === currentFieldKey) || TARGET_FIELDS[0];
                  const isIgnored = currentFieldKey === "ignore";

                  return (
                    <th
                      key={colIdx}
                      className={`p-3 min-w-[180px] max-w-[240px] border-r border-slate-800 align-top transition-colors ${
                        isIgnored ? "bg-slate-950/80 text-slate-500 opacity-60" : "bg-slate-900"
                      }`}
                    >
                      {/* Nome original da coluna no Excel */}
                      <div className="text-[11px] font-semibold text-slate-400 truncate mb-1.5 font-mono" title={headerText}>
                        Coluna {colIdx + 1}: <span className="text-slate-200">{headerText}</span>
                      </div>

                      {/* Dropdown Seletor Interativo do Sistema */}
                      <div className="relative">
                        <select
                          value={currentFieldKey}
                          onChange={(e) => {
                            const newTarget = e.target.value as TargetField;
                            setColumnMapping((prev) => ({
                              ...prev,
                              [colIdx]: newTarget
                            }));
                          }}
                          className={`w-full appearance-none rounded-xl text-xs font-bold px-3 py-2 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${currentField.color}`}
                        >
                          {TARGET_FIELDS.map((opt) => (
                            <option key={opt.key} value={opt.key} className="bg-slate-900 text-white py-1">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Linhas de Dados de Pré-Visualização */}
            <tbody className="divide-y divide-slate-800/50 font-mono">
              {dataRows.slice(0, 15).map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 text-center text-slate-600 border-r border-slate-800/80 bg-slate-950/40 text-[11px]">
                    {rowIdx + 1}
                  </td>
                  {columnHeaders.map((_, colIdx) => {
                    const isIgnored = (columnMapping[colIdx] || "ignore") === "ignore";
                    const val = row[colIdx];
                    return (
                      <td
                        key={colIdx}
                        className={`p-3 border-r border-slate-800/60 truncate max-w-[240px] text-xs ${
                          isIgnored ? "text-slate-600 bg-slate-950/60 line-through opacity-40" : "text-slate-200"
                        }`}
                        title={String(val || "")}
                      >
                        {val !== undefined && val !== null && String(val) !== "" ? String(val) : <span className="text-slate-700 italic">vazio</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Barra de Progresso de Importação */}
        {importing && (
          <div className="p-4 rounded-2xl bg-brand-950/40 border border-brand-500/30 space-y-2 animate-fade-in shrink-0">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-brand-300 flex items-center gap-2 font-bold">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
                Gravando com ultra-performance no Appwrite Cloud...
              </span>
              <span className="text-brand-400 font-bold">
                {importProgress.current} / {importProgress.total} (
                {Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-500 to-amber-400 h-full transition-all duration-150 rounded-full"
                style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer com Botões de Ação */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <strong>{mappedParticipants.length}</strong> atletas prontos
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={importing || mappedParticipants.length === 0 || !isEventValid}
              title={!isEventValid ? "Preencha o Nome do Evento para continuar" : ""}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Importar {mappedParticipants.length} Atletas
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

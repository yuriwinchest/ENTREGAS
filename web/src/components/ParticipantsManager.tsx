import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Upload, 
  Download, 
  Search, 
  Check, 
  Clock, 
  Filter, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  AlertCircle,
  RefreshCw,
  QrCode,
  Eye,
  CheckCircle2,
  Calendar,
  CreditCard,
  Shirt,
  Cpu
} from "lucide-react";
import * as XLSX from "xlsx";
import { Participant } from "../types";
import { api, databases, DATABASE_ID, COLLECTIONS } from "../lib/appwrite";
import { QRCodeModal } from "./QRCodeModal";

export const ParticipantsManager: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "delivered" | "pending">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR Code Modal State
  const [selectedQrAthlete, setSelectedQrAthlete] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.listParticipants({
        limit,
        offset: page * limit,
        deliveredOnly: filter === "delivered",
        pendingOnly: filter === "pending",
        search: search.trim() || undefined
      });
      setParticipants(res.documents);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Erro ao carregar participantes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, filter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle Excel/CSV file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { 
          defval: "",
          raw: false,
          dateNF: "dd/mm/yyyy"
        });

        if (rawData.length === 0) {
          alert("Arquivo vazio ou sem dados legíveis.");
          return;
        }

        const formatBirthDate = (val: any): string => {
          if (!val) return "";
          if (typeof val === "number" && val > 10000 && val < 60000) {
            const date = new Date((val - 25569) * 86400 * 1000);
            const d = String(date.getUTCDate()).padStart(2, "0");
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const y = date.getUTCFullYear();
            return `${d}/${m}/${y}`;
          }
          const s = String(val).trim();
          if (s.includes("T")) {
            const parts = s.split("T")[0].split("-");
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return s.slice(0, 30);
        };

        // Mapeamento inteligente e padronizado de colunas
        const mapped = rawData.map((row, idx) => {
          const keys = Object.keys(row);
          const findVal = (patterns: string[]) => {
            const k = keys.find((key) => patterns.some((p) => key.toLowerCase().includes(p)));
            return k ? String(row[k]).trim() : "";
          };

          // 1. Numero
          const bib = findVal(["num", "peito", "dorsal", "bib", "numero", "inscricao", "inscrição"]) || String(idx + 1001);
          
          // 2. Chip
          const chip = (findVal(["chip", "epc", "rfid", "tag", "transponder"]) || bib).toUpperCase();
          
          // 3. Nome
          const name = (findVal(["nome", "atleta", "participante", "name", "runner", "cliente"]) || `ATLETA ${bib}`).toUpperCase();
          
          // 4. Nascimento
          const rawBirth = findVal(["nasc", "data", "birth", "aniversario", "dt_nasc", "nascimento", "dt."]);
          const birth = formatBirthDate(rawBirth);
          
          // 5. Modalidade
          const modality = findVal(["modalidade", "percurso", "distancia", "distância", "corrida", "prova", "modality", "tipo"]) || "Geral";
          
          // 6. Camisa
          const shirt = (findVal(["camisa", "camiseta", "tamanho", "shirt", "tam_camisa", "tam", "tam."]) || "M").toUpperCase();
          
          // 7. Cpf
          const cpf = findVal(["cpf", "documento", "doc", "identidade", "rg", "doc."]);
          
          // 8. Qr code
          const qr = findVal(["qr", "qrcode", "qr_code", "voucher", "codigo_qr", "chave", "código"]) || bib;

          const category = findVal(["categoria", "faixa", "cat", "faixa etaria", "faixa etária"]) || "Geral";
          const sex = (findVal(["sexo", "genero", "gênero", "sex"]) || "M").toUpperCase().substring(0, 1);

          return {
            bib_number: bib,
            chip: chip,
            name: name,
            birth_date: birth,
            modality: modality,
            shirt: shirt,
            cpf: cpf,
            qr_code: qr,
            category: category,
            sex: sex
          };
        });

        setImportPreview(mapped);
        setIsImportModalOpen(true);
      } catch (err) {
        console.error("Erro ao ler planilha:", err);
        alert("Erro ao processar arquivo. Certifique-se de enviar um arquivo Excel (.xlsx, .xls) ou CSV válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const runBatchImport = async () => {
    if (importPreview.length === 0 || importing) return;
    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.length });

    try {
      const res = await api.batchImportParticipants(importPreview, (curr, tot) => {
        setImportProgress({ current: curr, total: tot });
      });

      if (res.inserted > 0) {
        alert(`Importação concluída com sucesso!\n✓ ${res.inserted} atletas cadastrados no Appwrite Cloud.\n${res.errors > 0 ? `! ${res.errors} registros não puderam ser gravados.` : ""}`);
        setIsImportModalOpen(false);
        setImportPreview([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadData();
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

  // Exportar Relatório Geral para Excel
  const exportToExcel = async () => {
    try {
      const allRes = await api.listParticipants({ limit: 5000 });
      const exportData = allRes.documents.map((p) => ({
        "Número": p.bib_number,
        "Chip EPC": p.chip,
        "Nome do Atleta": p.name,
        "Data de Nascimento": p.birth_date || "",
        "Modalidade": p.modality || "Geral",
        "Camisa": p.shirt || "",
        "CPF": p.cpf || "",
        "QR Code": p.qr_code || p.bib_number,
        "Status": p.delivered_at ? "ENTREGUE" : "PENDENTE",
        "Data/Hora Entrega": p.delivered_at ? new Date(p.delivered_at).toLocaleString("pt-BR") : "",
        "Retirado Por": p.receiver_name || ""
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatório Geral");
      XLSX.writeFile(wb, `relatorio-entregas-chipower-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Erro ao exportar:", err);
      alert("Falha ao exportar dados.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            Base de Atletas & Importação
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie as inscrições, faça upload de planilhas Excel/CSV e acompanhe as entregas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Anexar Planilha (Excel / CSV)
          </button>

          <button
            onClick={exportToExcel}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Exportar Relatório
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por peito, chip, nome, CPF ou QR Code..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => { setFilter("all"); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              filter === "all" ? "bg-brand-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Todos ({totalCount})
          </button>

          <button
            onClick={() => { setFilter("delivered"); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
              filter === "delivered" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-emerald-400"
            }`}
          >
            <Check className="w-3.5 h-3.5" /> Entregues
          </button>

          <button
            onClick={() => { setFilter("pending"); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
              filter === "pending" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-amber-400"
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Pendentes
          </button>

          <button
            onClick={loadData}
            title="Atualizar lista"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabela de Participantes com as 8 Colunas Oficiais */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Numero</th>
                <th className="px-4 py-3.5">Chip</th>
                <th className="px-4 py-3.5">Nome</th>
                <th className="px-4 py-3.5">Nascimento</th>
                <th className="px-4 py-3.5">Modalidade</th>
                <th className="px-4 py-3.5">Camisa</th>
                <th className="px-4 py-3.5">Cpf</th>
                <th className="px-4 py-3.5 text-center">Qr Code</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Retirada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando atletas da nuvem...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500">
                    Nenhum participante encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.$id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* 1. Numero */}
                    <td className="px-4 py-3 font-display font-black text-brand-400 text-sm">
                      #{p.bib_number}
                    </td>

                    {/* 2. Chip */}
                    <td className="px-4 py-3 font-mono text-[11px] text-emerald-400 font-medium">
                      {p.chip}
                    </td>

                    {/* 3. Nome */}
                    <td className="px-4 py-3 font-bold text-white max-w-xs truncate">
                      {p.name}
                    </td>

                    {/* 4. Nascimento */}
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {p.birth_date || "—"}
                    </td>

                    {/* 5. Modalidade */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                        {p.modality || "Geral"}
                      </span>
                    </td>

                    {/* 6. Camisa */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono text-[11px]">
                        {p.shirt || "-"}
                      </span>
                    </td>

                    {/* 7. Cpf */}
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {p.cpf || "—"}
                    </td>

                    {/* 8. Qr Code */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedQrAthlete(p)}
                        title="Visualizar e Baixar QR Code"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-brand-500 hover:bg-brand-500/10 text-brand-400 hover:text-brand-300 transition-all font-mono text-[10px]"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{p.qr_code || p.bib_number}</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {p.delivered_at ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Entregue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold text-[11px]">
                          <Clock className="w-3 h-3" />
                          Pendente
                        </span>
                      )}
                    </td>

                    {/* Retirada */}
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {p.delivered_at ? (
                        <div>
                          <span className="block text-slate-200 font-medium">
                            {new Date(p.delivered_at).toLocaleString("pt-BR")}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Por: {p.receiver_name || "Titular"}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>
            Mostrando {participants.length > 0 ? page * limit + 1 : 0} até {Math.min((page + 1) * limit, totalCount)} de {totalCount} atletas
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
            >
              Anterior
            </button>
            <span className="font-mono px-2 text-slate-300 font-medium">
              Página {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= totalCount}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação e Conferência ao Anexar Planilha */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-6xl w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-6 animate-scale-in max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-display">
                    Conferência de Planilha Anexada
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Total de registros: <strong className="text-white">{importPreview.length} atletas</strong></span>
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 8 Campos Identificados (Numero, Chip, Nome, Nascimento, Modalidade, Camisa, Cpf, Qr code)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Preview da Tabela com os 8 Campos Solicitados */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden flex-1 overflow-y-auto bg-slate-950/90 shadow-inner">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-300 font-bold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-brand-400">Numero</th>
                    <th className="p-3 text-emerald-400">Chip</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Nascimento</th>
                    <th className="p-3">Modalidade</th>
                    <th className="p-3 text-amber-400">Camisa</th>
                    <th className="p-3">Cpf</th>
                    <th className="p-3 text-center">Qr code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {importPreview.slice(0, 100).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      
                      {/* 1. Numero */}
                      <td className="p-3 font-display font-black text-brand-400">
                        #{row.bib_number}
                      </td>

                      {/* 2. Chip */}
                      <td className="p-3 font-mono text-emerald-400 font-medium">
                        {row.chip}
                      </td>

                      {/* 3. Nome */}
                      <td className="p-3 font-bold text-white max-w-[180px] truncate">
                        {row.name}
                      </td>

                      {/* 4. Nascimento */}
                      <td className="p-3 font-mono text-slate-300">
                        {row.birth_date || "—"}
                      </td>

                      {/* 5. Modalidade */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {row.modality || "Geral"}
                        </span>
                      </td>

                      {/* 6. Camisa */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono">
                          {row.shirt || "Padrão"}
                        </span>
                      </td>

                      {/* 7. Cpf */}
                      <td className="p-3 font-mono text-slate-400">
                        {row.cpf || "—"}
                      </td>

                      {/* 8. Qr code */}
                      <td className="p-3 text-center font-mono">
                        <button
                          type="button"
                          onClick={() => setSelectedQrAthlete(row)}
                          title="Ver QR Code do Atleta"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-brand-500 text-brand-400 text-[10px]"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>{row.qr_code}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 100 && (
                <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/90 border-t border-slate-800">
                  Mostrando os primeiros 100 de {importPreview.length} registros para pré-visualização rápida. Todos serão importados.
                </div>
              )}
            </div>

            {/* Barra de Progresso durante upload */}
            {importing && (
              <div className="space-y-2 shrink-0">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-500" />
                    Enviando atletas para o Appwrite Cloud...
                  </span>
                  <span className="font-bold text-brand-400">
                    {importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-500 to-amber-500 h-full transition-all duration-200 shadow-lg shadow-brand-500/50"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Botões do Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 shrink-0">
              <span className="text-xs text-slate-400">
                Verifique se todos os campos estão alinhados antes de confirmar.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportPreview([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={importing}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={runBatchImport}
                  disabled={importing}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gravando na Nuvem...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Importar {importPreview.length} Atletas</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de QR Code Individual */}
      {selectedQrAthlete && (
        <QRCodeModal
          athlete={selectedQrAthlete}
          onClose={() => setSelectedQrAthlete(null)}
        />
      )}

    </div>
  );
};

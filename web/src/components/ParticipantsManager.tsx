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
  Cpu,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Printer,
  X,
  FolderOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import * as XLSX from "xlsx";
import { Participant, EventItem } from "../types";
import { api } from "../lib/appwrite";
import { useSession } from "../lib/session";
import { runBulkOperation } from "../hooks/useLiveSync";
import { QRCodeModal } from "./QRCodeModal";
import { EditAthleteModal } from "./EditAthleteModal";
import { ImportWizardModal } from "./ImportWizardModal";
import { DeliveryReceiptModal } from "./DeliveryReceiptModal";

interface ParticipantsManagerProps {
  events?: EventItem[];
  activeEvent?: EventItem | null;
  onSelectEvent?: (event: EventItem | null) => void;
  onRefreshEvents?: () => void;
}

export const ParticipantsManager: React.FC<ParticipantsManagerProps> = ({
  events = [],
  activeEvent = null,
  onSelectEvent,
  onRefreshEvents
}) => {
  const { can } = useSession();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Descarta respostas antigas que cheguem fora de ordem após trocas rápidas
  // de filtro/busca — era uma das causas da lista "travada" carregando.
  const requisicaoAtual = useRef(0);
  const [filter, setFilter] = useState<"all" | "delivered" | "pending">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  // Import Wizard State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importWorkbook, setImportWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [importFileName, setImportFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Receipt Modal State
  const [receiptAthlete, setReceiptAthlete] = useState<Participant | null>(null);

  // QR Code Modal State
  const [selectedQrAthlete, setSelectedQrAthlete] = useState<any | null>(null);

  // Edit Modal State
  const [editingAthlete, setEditingAthlete] = useState<Participant | null>(null);

  // Delete Single State
  const [athleteToDelete, setAthleteToDelete] = useState<Participant | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);

  // Delete All State
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"event_only" | "all_events">("event_only");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  // Reset Deliveries State
  const [isResetDeliveriesModalOpen, setIsResetDeliveriesModalOpen] = useState(false);
  const [resettingDeliveries, setResettingDeliveries] = useState(false);
  const [resetProgress, setResetProgress] = useState({ current: 0, total: 0 });

  const loadData = async () => {
    const idDaRequisicao = ++requisicaoAtual.current;
    setLoading(true);

    try {
      const res = await api.listParticipants({
        limit,
        offset: page * limit,
        deliveredOnly: filter === "delivered",
        pendingOnly: filter === "pending",
        search: search.trim() || undefined,
        eventId: activeEvent ? activeEvent.$id : undefined
      });

      if (idDaRequisicao !== requisicaoAtual.current) return;

      setParticipants(res.documents);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Erro ao carregar atletas:", err);
    } finally {
      if (idDaRequisicao === requisicaoAtual.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [page, filter, activeEvent?.$id, search]);

  // Handle Excel/CSV file upload via Interactive Wizard
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Zerar o valor permite reanexar o MESMO arquivo em seguida — sem isso o
    // segundo clique não disparava evento algum e nada acontecia na tela.
    e.target.value = "";
    if (!file) return;

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bytes = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(bytes, { type: "array", cellDates: true });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          alert("O arquivo não possui planilhas legíveis.");
          return;
        }
        setImportWorkbook(wb);
        setIsImportModalOpen(true);
      } catch (err) {
        console.error("Erro ao ler arquivo:", err);
        alert("Erro ao ler o arquivo selecionado. Formatos suportados: .xlsx, .xls, .csv");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Excluir Atleta Individual
  const confirmDeleteSingle = async () => {
    if (!athleteToDelete || deletingSingle) return;
    setDeletingSingle(true);
    try {
      const success = await api.deleteParticipant(athleteToDelete.$id);
      if (success) {
        setAthleteToDelete(null);
        loadData();
        if (onRefreshEvents) onRefreshEvents();
      } else {
        alert("Não foi possível excluir o atleta. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao deletar atleta:", err);
    } finally {
      setDeletingSingle(false);
    }
  };

  // Limpar Base (Exclusão Ultra-Rápida)
  const runDeleteAllParticipants = async () => {
    if (deleteConfirmText !== "EXCLUIR TUDO" || deletingAll) return;
    setDeletingAll(true);
    setDeleteProgress({ current: 0, total: totalCount || 100 });

    const targetEventId = deleteMode === "event_only" && activeEvent ? activeEvent.$id : undefined;

    try {
      // Suspende a sincronização automática: sem isso, cada documento excluído
      // dispararia uma recarga completa e a tela travava até o fim do lote.
      const res = await runBulkOperation(() =>
        api.deleteAllParticipants(targetEventId, (curr, tot) => {
          setDeleteProgress({ current: curr, total: tot });
        })
      );

      alert(`Exclusão concluída com sucesso!\n✓ ${res.deleted} atletas excluídos com alta performance.`);
      setIsDeleteAllModalOpen(false);
      setDeleteConfirmText("");
      setPage(0);
      loadData();
      if (onRefreshEvents) onRefreshEvents();
    } catch (err: any) {
      console.error("Erro ao limpar base:", err);
      alert("Erro ao excluir dados.");
    } finally {
      setDeletingAll(false);
    }
  };

  // Resetar Status de Entrega
  const runResetAllDeliveries = async () => {
    if (resettingDeliveries) return;
    setResettingDeliveries(true);
    setResetProgress({ current: 0, total: totalCount });

    const targetEventId = activeEvent ? activeEvent.$id : undefined;

    try {
      const res = await runBulkOperation(() =>
        api.resetAllDeliveries(targetEventId, (curr, tot) => {
          setResetProgress({ current: curr, total: tot });
        })
      );

      alert(`Status de entrega resetado com sucesso!\n✓ ${res.reset} atletas retornaram para 'Pendente'.`);
      setIsResetDeliveriesModalOpen(false);
      loadData();
      if (onRefreshEvents) onRefreshEvents();
    } catch (err: any) {
      console.error("Erro ao resetar entregas:", err);
      alert("Erro ao resetar status de entrega.");
    } finally {
      setResettingDeliveries(false);
    }
  };

  // Exportar Relatório para Excel
  const exportToExcel = async () => {
    try {
      const allRes = await api.listParticipants({ 
        limit: 5000,
        eventId: activeEvent ? activeEvent.$id : undefined
      });
      const exportData = allRes.documents.map((p) => ({
        "Número": p.bib_number,
        "Chip EPC": p.chip,
        "Nome do Atleta": p.name,
        "Evento": p.event_name || "Geral",
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
      const sheetName = activeEvent ? activeEvent.name.slice(0, 30) : "Relatório Geral";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `relatorio-entregas-${activeEvent ? activeEvent.name.replace(/\s+/g, "-") : "geral"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Erro ao exportar:", err);
      alert("Falha ao exportar dados.");
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

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
            {activeEvent ? (
              <span>Exibindo atletas do evento: <strong className="text-white font-semibold">{activeEvent.name}</strong></span>
            ) : (
              <span>Exibindo todos os atletas de todas as tabelas e eventos.</span>
            )}
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

          {can("athlete.import") && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Anexar Planilha (Excel / CSV)
            </button>
          )}

          {can("athlete.export") && (
          <button
            onClick={exportToExcel}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Exportar Relatório
          </button>
          )}

          {/* Resetar Entregas */}
          {can("data.reset") && (
          <button
            onClick={() => setIsResetDeliveriesModalOpen(true)}
            title="Resetar status de entrega para pendente"
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-amber-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetar Entregas
          </button>
          )}

          {/* Limpar Base */}
          {can("data.purge") && (
          <button
            onClick={() => {
              setDeleteConfirmText("");
              setDeleteMode(activeEvent ? "event_only" : "all_events");
              setIsDeleteAllModalOpen(true);
            }}
            title="Excluir participantes para iniciar novo evento"
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            Excluir / Limpar
          </button>
          )}
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
            placeholder="Buscar por número, chip, nome, CPF ou QR Code..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
          />
        </div>

        {/* Filters and Event Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          
          {/* Seletor Rápido de Evento */}
          {onSelectEvent && events.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
              <FolderOpen className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <select
                value={activeEvent?.$id || "all"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "all") {
                    onSelectEvent(null);
                  } else {
                    const ev = events.find((item) => item.$id === val);
                    if (ev) onSelectEvent(ev);
                  }
                  setPage(0);
                }}
                className="bg-transparent text-xs text-slate-200 font-semibold outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-slate-900 text-white">Todas as Tabelas / Eventos</option>
                {events.map((ev) => (
                  <option key={ev.$id} value={ev.$id} className="bg-slate-900 text-white">
                    {ev.name} ({ev.total_athletes || 0})
                  </option>
                ))}
              </select>
            </div>
          )}

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

      {/* Tabela de Participantes com Ações Completas */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3.5">Numero</th>
                <th className="px-3.5 py-3.5">Chip</th>
                <th className="px-3.5 py-3.5">Nome</th>
                <th className="px-3.5 py-3.5">Evento / Tabela</th>
                <th className="px-3.5 py-3.5">Nascimento</th>
                <th className="px-3.5 py-3.5">Modalidade</th>
                <th className="px-3.5 py-3.5">Camisa</th>
                <th className="px-3.5 py-3.5">Cpf</th>
                <th className="px-3.5 py-3.5 text-center">Qr Code</th>
                <th className="px-3.5 py-3.5">Status</th>
                <th className="px-3.5 py-3.5">Retirada</th>
                <th className="px-3.5 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando atletas da nuvem...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-500">
                    Nenhum participante encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.$id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* 1. Numero */}
                    <td className="px-3.5 py-3 font-display font-black text-brand-400 text-sm">
                      #{p.bib_number}
                    </td>

                    {/* 2. Chip */}
                    <td className="px-3.5 py-3 font-mono text-[11px] text-emerald-400 font-medium">
                      {p.chip}
                    </td>

                    {/* 3. Nome */}
                    <td className="px-3.5 py-3 font-bold text-white max-w-xs truncate">
                      {p.name}
                    </td>

                    {/* 4. Evento */}
                    <td className="px-3.5 py-3 font-medium text-[11px] text-slate-300">
                      <span
                        className="inline-block max-w-[220px] truncate align-middle px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        title={p.event_name || "Geral"}
                      >
                        {p.event_name || "Geral"}
                      </span>
                    </td>

                    {/* 5. Nascimento */}
                    <td className="px-3.5 py-3 font-mono text-slate-300">
                      {p.birth_date || "—"}
                    </td>

                    {/* 6. Modalidade */}
                    <td className="px-3.5 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                        {p.modality || "Geral"}
                      </span>
                    </td>

                    {/* 7. Camisa */}
                    <td className="px-3.5 py-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono text-[11px]">
                        {p.shirt || "-"}
                      </span>
                    </td>

                    {/* 8. Cpf */}
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400">
                      {p.cpf || "—"}
                    </td>

                    {/* 9. Qr Code */}
                    <td className="px-3.5 py-3 text-center">
                      <button
                        onClick={() => setSelectedQrAthlete(p)}
                        title="Visualizar e Baixar QR Code"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-brand-500 hover:bg-brand-500/10 text-brand-400 hover:text-brand-300 transition-all font-mono text-[10px]"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{p.qr_code || p.bib_number}</span>
                      </button>
                    </td>

                    {/* 10. Status */}
                    <td className="px-3.5 py-3">
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

                    {/* 11. Retirada */}
                    <td className="px-3.5 py-3 text-[11px] text-slate-400">
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

                    {/* 12. Ações */}
                    <td className="px-3.5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {p.delivered_at && (
                          <button
                            onClick={() => setReceiptAthlete(p)}
                            title="Imprimir Comprovante de Retirada"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can("athlete.edit") && (
                          <button
                            onClick={() => setEditingAthlete(p)}
                            title="Editar dados do atleta"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-brand-500 text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can("athlete.delete") && (
                          <button
                            onClick={() => setAthleteToDelete(p)}
                            title="Excluir este atleta"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Mostrando <strong>{participants.length}</strong> de <strong>{totalCount}</strong> atletas
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono">
                Página {page + 1} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Exclusão Individual */}
      {athleteToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full border border-rose-500/40 bg-slate-900 shadow-2xl space-y-5 animate-scale-in text-slate-100">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Excluir Atleta?
                </h3>
                <p className="text-xs text-rose-200/80">
                  #{athleteToDelete.bib_number} - {athleteToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Tem certeza que deseja excluir o cadastro de <strong>{athleteToDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAthleteToDelete(null)}
                disabled={deletingSingle}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingle}
                disabled={deletingSingle}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer"
              >
                {deletingSingle ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão em Lote */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-rose-500/50 bg-slate-900 shadow-2xl space-y-5 animate-scale-in text-slate-100">
            
            <div className="flex items-center gap-3.5 text-rose-400">
              <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-display">
                  Exclusão Ultra-Rápida de Dados
                </h3>
                <p className="text-xs text-rose-300/80">
                  Processamento em lote via worker pool de alta velocidade
                </p>
              </div>
            </div>

            {/* Escopo da Exclusão */}
            {activeEvent && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Escolha o escopo da exclusão:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteMode("event_only")}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                      deleteMode === "event_only"
                        ? "bg-brand-950/40 border-brand-500 text-brand-300 shadow-sm"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold text-white">Excluir apenas atletas de "{activeEvent.name}"</div>
                    <div className="text-[11px] opacity-80">Mantém as outras tabelas e eventos intactos.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteMode("all_events")}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                      deleteMode === "all_events"
                        ? "bg-rose-950/40 border-rose-500 text-rose-300 shadow-sm"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold text-rose-300">Excluir TODOS os atletas de TODOS os eventos</div>
                    <div className="text-[11px] opacity-80">Limpeza total de toda a base da nuvem.</div>
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 space-y-1">
              <p className="font-bold text-white">
                ⚠️ Ação definitiva e irreversível!
              </p>
              <p>
                Os dados serão excluídos permanentemente do Appwrite Cloud.
              </p>
            </div>

            {/* Confirmação por texto */}
            <div className="space-y-2 text-xs">
              <label className="block text-slate-300 font-medium">
                Para confirmar a exclusão, digite exatamente <strong className="text-rose-400 font-mono">EXCLUIR TUDO</strong> abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="EXCLUIR TUDO"
                className="w-full px-4 py-2.5 bg-slate-950 border border-rose-500/50 rounded-xl text-white font-mono text-center font-bold text-sm tracking-widest outline-none focus:border-rose-400"
              />
            </div>

            {/* Barra de Progresso durante Exclusão */}
            {deletingAll && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                    Excluindo com 25 workers paralelos...
                  </span>
                  <span className="font-bold text-rose-400">
                    {deleteProgress.current} / {deleteProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full transition-all duration-150"
                    style={{ width: `${Math.min(100, (deleteProgress.current / (deleteProgress.total || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={deletingAll}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runDeleteAllParticipants}
                disabled={deleteConfirmText !== "EXCLUIR TUDO" || deletingAll}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                {deletingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar e Excluir</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Reset de Entregas */}
      {isResetDeliveriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full border border-amber-500/40 bg-slate-900 shadow-2xl space-y-5 animate-scale-in text-slate-100">
            
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Resetar Entregas?
                </h3>
                <p className="text-xs text-amber-200/80">
                  {activeEvent ? `Evento: ${activeEvent.name}` : "Todos os Eventos"}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Esta ação manterá os cadastros e chips intactos, mas resetará a data e o responsável pela retirada dos atletas {activeEvent ? `de "${activeEvent.name}"` : "de todas as tabelas"}, retornando-os para "Pendente".
            </p>

            {resettingDeliveries && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    Resetando entregas...
                  </span>
                  <span className="font-bold text-amber-400">
                    {resetProgress.current} / {resetProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-150"
                    style={{ width: `${Math.min(100, (resetProgress.current / (resetProgress.total || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetDeliveriesModalOpen(false)}
                disabled={resettingDeliveries}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runResetAllDeliveries}
                disabled={resettingDeliveries}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
              >
                {resettingDeliveries ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetando...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Sim, Resetar Entregas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de QR Code */}
      {selectedQrAthlete && (
        <QRCodeModal
          athlete={selectedQrAthlete}
          onClose={() => setSelectedQrAthlete(null)}
        />
      )}

      {/* Modal de Edição de Atleta */}
      {editingAthlete && (
        <EditAthleteModal
          athlete={editingAthlete}
          onClose={() => setEditingAthlete(null)}
          onSaved={(updated) => {
            setParticipants((prev) => prev.map((item) => (item.$id === updated.$id ? updated : item)));
            setEditingAthlete(null);
            loadData();
            if (onRefreshEvents) onRefreshEvents();
          }}
        />
      )}

      {/* Modal de Importação */}
      {isImportModalOpen && importWorkbook && (
        <ImportWizardModal
          workbook={importWorkbook}
          fileName={importFileName}
          existingEvents={events}
          activeEventId={activeEvent?.$id}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportWorkbook(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onSuccess={(newEvent) => {
            setIsImportModalOpen(false);
            setImportWorkbook(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (onRefreshEvents) onRefreshEvents();
            if (newEvent && onSelectEvent) {
              onSelectEvent(newEvent);
            }
            loadData();
          }}
        />
      )}

      {/* Modal de Comprovante de Retirada */}
      {receiptAthlete && (
        <DeliveryReceiptModal
          athlete={receiptAthlete}
          onClose={() => setReceiptAthlete(null)}
        />
      )}

    </div>
  );
};

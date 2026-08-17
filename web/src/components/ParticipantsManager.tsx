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
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { Participant } from "../types";
import { api } from "../lib/appwrite";
import { QRCodeModal } from "./QRCodeModal";
import { EditAthleteModal } from "./EditAthleteModal";
import { ImportWizardModal } from "./ImportWizardModal";
import { DeliveryReceiptModal } from "./DeliveryReceiptModal";

export const ParticipantsManager: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  // Reset Deliveries State
  const [isResetDeliveriesModalOpen, setIsResetDeliveriesModalOpen] = useState(false);
  const [resettingDeliveries, setResettingDeliveries] = useState(false);
  const [resetProgress, setResetProgress] = useState({ current: 0, total: 0 });

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

  // Handle Excel/CSV file upload via Interactive Wizard
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
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
    reader.readAsBinaryString(file);
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
      } else {
        alert("Não foi possível excluir o atleta. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao deletar atleta:", err);
    } finally {
      setDeletingSingle(false);
    }
  };

  // Limpar Base Inteira (Excluir Todos os Atletas)
  const runDeleteAllParticipants = async () => {
    if (deleteConfirmText !== "EXCLUIR TUDO" || deletingAll) return;
    setDeletingAll(true);
    setDeleteProgress({ current: 0, total: totalCount || 100 });

    try {
      const res = await api.deleteAllParticipants((curr, tot) => {
        setDeleteProgress({ current: curr, total: tot });
      });

      alert(`Base de dados limpa com sucesso!\n✓ ${res.deleted} atletas excluídos.`);
      setIsDeleteAllModalOpen(false);
      setDeleteConfirmText("");
      setPage(0);
      loadData();
    } catch (err: any) {
      console.error("Erro ao limpar base:", err);
      alert("Erro ao limpar base de dados.");
    } finally {
      setDeletingAll(false);
    }
  };

  // Resetar Status de Entrega de Todos os Atletas
  const runResetAllDeliveries = async () => {
    if (resettingDeliveries) return;
    setResettingDeliveries(true);
    setResetProgress({ current: 0, total: totalCount });

    try {
      const res = await api.resetAllDeliveries((curr, tot) => {
        setResetProgress({ current: curr, total: tot });
      });

      alert(`Status de entrega resetado com sucesso!\n✓ ${res.reset} atletas retornaram para 'Pendente'.`);
      setIsResetDeliveriesModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error("Erro ao resetar entregas:", err);
      alert("Erro ao resetar status de entrega.");
    } finally {
      setResettingDeliveries(false);
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
            Gerencie as inscrições, faça upload de planilhas Excel/CSV, edite cadastros e limpe a base para novos eventos.
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
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Exportar Relatório
          </button>

          {/* Resetar Entregas */}
          <button
            onClick={() => setIsResetDeliveriesModalOpen(true)}
            title="Resetar status de entrega de todos os atletas para pendente"
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-amber-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetar Entregas
          </button>

          {/* Limpar Base Completa */}
          <button
            onClick={() => {
              setDeleteConfirmText("");
              setIsDeleteAllModalOpen(true);
            }}
            title="Excluir todos os participantes para iniciar novo evento"
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            Limpar Base
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

      {/* Tabela de Participantes com Ações Completas */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3.5">Numero</th>
                <th className="px-3.5 py-3.5">Chip</th>
                <th className="px-3.5 py-3.5">Nome</th>
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
                  <td colSpan={11} className="text-center py-12 text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando atletas da nuvem...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-500">
                    Nenhum participante encontrado na base de dados.
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

                    {/* 4. Nascimento */}
                    <td className="px-3.5 py-3 font-mono text-slate-300">
                      {p.birth_date || "—"}
                    </td>

                    {/* 5. Modalidade */}
                    <td className="px-3.5 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                        {p.modality || "Geral"}
                      </span>
                    </td>

                    {/* 6. Camisa */}
                    <td className="px-3.5 py-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono text-[11px]">
                        {p.shirt || "-"}
                      </span>
                    </td>

                    {/* 7. Cpf */}
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400">
                      {p.cpf || "—"}
                    </td>

                    {/* 8. Qr Code */}
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

                    {/* Status */}
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

                    {/* Retirada */}
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

                    {/* Ações (Imprimir Recibo se entregue, Editar e Excluir) */}
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
                        <button
                          onClick={() => setEditingAthlete(p)}
                          title="Editar dados do atleta"
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-brand-500 text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAthleteToDelete(p)}
                          title="Excluir este atleta"
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {/* Modal de Exclusão Individual */}
      {athleteToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-5 animate-scale-in text-slate-100">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Excluir Atleta?
                </h3>
                <p className="text-xs text-slate-400">
                  Esta ação removerá o atleta da base de dados.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <p><strong className="text-brand-400">#{athleteToDelete.bib_number}</strong> - <strong className="text-white">{athleteToDelete.name}</strong></p>
              <p className="text-slate-400">Chip: <span className="font-mono text-emerald-400">{athleteToDelete.chip}</span> | Camisa: <span className="text-amber-300 font-bold">{athleteToDelete.shirt || "-"}</span></p>
            </div>

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
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                {deletingSingle ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Limpeza Total da Base (Excluir Todos) */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-lg w-full border-2 border-rose-500/40 bg-slate-900 shadow-2xl space-y-6 animate-scale-in text-slate-100">
            
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                <AlertTriangle className="w-8 h-8 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-display">
                  Limpar Toda a Base de Atletas?
                </h3>
                <p className="text-xs text-rose-300/80">
                  Ação Crítica de Reinicialização de Evento
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 space-y-2">
              <p className="font-bold text-white">
                ⚠️ ATENÇÃO: Esta ação é definitiva e irreversível!
              </p>
              <p>
                Todos os <strong className="text-white">{totalCount} atletas</strong> cadastrados e seus respectivos históricos de entrega serão excluídos do Appwrite Cloud para você iniciar um novo evento ou teste do zero.
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
                    Excluindo atletas da nuvem...
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
                    <span>Limpando Base...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar e Limpar Tudo</span>
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
                  Retornar todos os atletas para o status Pendente
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Esta ação manterá todos os cadastros e chips intactos, mas resetará a data e o responsável pela retirada de todos os atletas entregues, permitindo reiniciar a entrega dos kits.
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
          }}
        />
      )}

      {/* Modal de Importação com Mapeamento Interativo de Colunas (Estilo Sistema de Cronometragem) */}
      {isImportModalOpen && importWorkbook && (
        <ImportWizardModal
          workbook={importWorkbook}
          fileName={importFileName}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportWorkbook(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onSuccess={() => {
            setIsImportModalOpen(false);
            setImportWorkbook(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
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

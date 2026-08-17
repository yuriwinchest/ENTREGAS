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
  RefreshCw
} from "lucide-react";
import * as XLSX from "xlsx";
import { Participant } from "../types";
import { api, databases, DATABASE_ID, COLLECTIONS } from "../lib/appwrite";

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
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (rawData.length === 0) {
          alert("Arquivo vazio ou sem dados legíveis.");
          return;
        }

        // Mapeamento inteligente de colunas
        const mapped = rawData.map((row, idx) => {
          const keys = Object.keys(row);
          const findVal = (patterns: string[]) => {
            const k = keys.find((key) => patterns.some((p) => key.toLowerCase().includes(p)));
            return k ? row[k] : "";
          };

          const bib = String(findVal(["num", "peito", "dorsal", "bib"]) || (idx + 1000)).trim();
          const chip = String(findVal(["chip", "epc", "rfid", "tag"]) || bib).trim().toUpperCase();
          const name = String(findVal(["nome", "atleta", "participante", "name"]) || "ATLETA").trim().toUpperCase();
          const cpf = String(findVal(["cpf", "documento"]) || "").trim();
          const shirt = String(findVal(["camisa", "camiseta", "tamanho", "shirt"]) || "M").trim().toUpperCase();
          const modality = String(findVal(["modalidade", "percurso", "distancia", "corrida"]) || "Geral").trim();
          const category = String(findVal(["categoria", "faixa", "cat"]) || "Geral").trim();
          const birth = String(findVal(["nasc", "data", "birth"]) || "").trim();
          const sex = String(findVal(["sexo", "genero", "sex"]) || "M").trim().toUpperCase().substring(0, 1);

          return {
            bib_number: bib,
            chip: chip,
            name: name,
            cpf: cpf,
            birth_date: birth,
            sex: sex,
            shirt: shirt,
            modality: modality,
            category: category
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

      alert(`Importação concluída!\n✓ ${res.inserted} atletas cadastrados no Appwrite.\n${res.errors > 0 ? `! ${res.errors} registros com erro.` : ""}`);
      setIsImportModalOpen(false);
      setImportPreview([]);
      loadData();
    } catch (err) {
      console.error("Falha na importação:", err);
      alert("Erro ao importar para a nuvem. Verifique o console.");
    } finally {
      setImporting(false);
    }
  };

  // Exportar Relatório Geral para Excel
  const exportToExcel = async () => {
    try {
      const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        XLSX ? undefined : undefined
      ].filter(Boolean) as any);

      // Buscar todos os registros
      const allDocs = await api.listParticipants({ limit: 5000 });

      const exportData = allDocs.documents.map((p) => ({
        "Número de Peito": p.bib_number,
        "Chip / EPC": p.chip,
        "Nome do Atleta": p.name,
        "CPF": p.cpf || "",
        "Data Nasc.": p.birth_date || "",
        "Sexo": p.sex || "",
        "Camiseta": p.shirt || "",
        "Modalidade": p.modality || "",
        "Categoria": p.category || "",
        "Status de Entrega": p.delivered_at ? "ENTREGUE" : "PENDENTE",
        "Data/Hora Entrega": p.delivered_at ? new Date(p.delivered_at).toLocaleString("pt-BR") : "",
        "Retirado Por": p.receiver_name || ""
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Entregas de Kits");
      XLSX.writeFile(wb, `Relatorio_Entregas_CHIPOWER_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Erro ao exportar:", err);
      alert("Falha ao exportar relatório.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" />
            Gestão de Atletas & Inscrições
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Total de {totalCount.toLocaleString("pt-BR")} atletas cadastrados no banco em nuvem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Button */}
          <button
            onClick={exportToExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-all flex items-center gap-2 border border-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Exportar Excel
          </button>

          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20"
          >
            <Upload className="w-4 h-4" />
            Importar Planilha (XLSX/CSV)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 outline-none focus:border-brand-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => { setFilter("all"); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              filter === "all" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-white"
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

      {/* Tabela de Participantes */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Peito</th>
                <th className="px-4 py-3.5">Atleta</th>
                <th className="px-4 py-3.5">Camiseta</th>
                <th className="px-4 py-3.5">Modalidade / Categoria</th>
                <th className="px-4 py-3.5">Chip EPC</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Retirada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando atletas da nuvem...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Nenhum participante encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.$id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-display font-black text-brand-400 text-sm">
                      {p.bib_number}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      {p.name}
                      {p.cpf && <span className="block text-[10px] text-slate-500 font-mono font-normal">CPF: {p.cpf}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono">
                        {p.shirt || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{p.modality || "Geral"}</span>
                      <span className="text-[10px] text-slate-500">{p.category || "Geral"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {p.chip}
                    </td>
                    <td className="px-4 py-3">
                      {p.delivered_at ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
                          Entregue
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold text-[11px]">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {p.delivered_at ? (
                        <div>
                          <span className="block text-slate-200">{new Date(p.delivered_at).toLocaleString("pt-BR")}</span>
                          <span className="text-[10px] text-slate-500">Por: {p.receiver_name}</span>
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
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Mostrando {participants.length > 0 ? page * limit + 1 : 0} até {Math.min((page + 1) * limit, totalCount)} de {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="font-mono px-2">Pág. {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= totalCount}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Importação */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-6 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Confirmar Importação de Planilha
                  </h3>
                  <p className="text-xs text-slate-400">
                    {importPreview.length} atletas identificados no arquivo.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview da Tabela */}
            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="p-2">Peito</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Camiseta</th>
                    <th className="p-2">Modalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {importPreview.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 font-bold text-brand-400">{row.bib_number}</td>
                      <td className="p-2">{row.name}</td>
                      <td className="p-2">{row.shirt}</td>
                      <td className="p-2">{row.modality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de Progresso durante upload */}
            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Enviando para o Appwrite...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-500 h-full transition-all duration-200"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Botões do Modal */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                disabled={importing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runBatchImport}
                disabled={importing}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center gap-2"
              >
                {importing ? "Importando..." : "Confirmar e Enviar para Nuvem"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

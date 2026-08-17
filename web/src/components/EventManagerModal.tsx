import React, { useState } from "react";
import { 
  X, 
  Layers, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  TrendingUp,
  Activity,
  ArrowRight
} from "lucide-react";
import { EventItem } from "../types";
import { api } from "../lib/appwrite";

interface EventManagerModalProps {
  events: EventItem[];
  activeEventId: string | null;
  onSelectEvent: (event: EventItem | null) => void;
  onRefreshEvents: () => void;
  onClose: () => void;
}

export const EventManagerModal: React.FC<EventManagerModalProps> = ({
  events,
  activeEventId,
  onSelectEvent,
  onRefreshEvents,
  onClose
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);

  // Edit State
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete State
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  // Criar Novo Evento
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creatingLoading) return;

    setCreatingLoading(true);
    try {
      const created = await api.createEvent({
        name: newName.trim(),
        event_date: newDate.trim() || undefined,
        location: newLocation.trim() || undefined
      });
      setNewName("");
      setNewDate("");
      setNewLocation("");
      setIsCreating(false);
      onRefreshEvents();
      onSelectEvent(created);
    } catch (err) {
      console.error("Erro ao criar evento:", err);
      alert("Erro ao cadastrar evento. Tente novamente.");
    } finally {
      setCreatingLoading(false);
    }
  };

  // Salvar Edição / Renomeação
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editName.trim() || savingEdit) return;

    setSavingEdit(true);
    try {
      await api.updateEvent(editingEvent.$id, {
        name: editName.trim(),
        event_date: editDate.trim(),
        location: editLocation.trim()
      });
      setEditingEvent(null);
      onRefreshEvents();
    } catch (err) {
      console.error("Erro ao atualizar evento:", err);
      alert("Erro ao salvar alterações no evento.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Excluir Evento e seus Atletas
  const handleConfirmDelete = async () => {
    if (!eventToDelete || deletingLoading) return;

    setDeletingLoading(true);
    setDeleteProgress({ current: 0, total: eventToDelete.total_athletes || 100 });
    try {
      await api.deleteEvent(eventToDelete.$id, (curr, tot) => {
        setDeleteProgress({ current: curr, total: tot });
      });

      if (activeEventId === eventToDelete.$id) {
        onSelectEvent(null);
      }
      setEventToDelete(null);
      onRefreshEvents();
    } catch (err) {
      console.error("Erro ao excluir evento:", err);
      alert("Erro ao excluir evento e sua tabela.");
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-navy-900 border border-slate-700/80 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-navy-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white font-display tracking-tight flex items-center gap-2">
                Gerenciador de Eventos e Tabelas
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-medium">
                  {events.length} {events.length === 1 ? "Evento" : "Eventos"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Organize e separe as tabelas de atletas por evento para não misturar contagens e entregas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectEvent(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !activeEventId
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Visão Geral (Todos os Eventos)
            </button>
          </div>

          <button
            onClick={() => {
              setIsCreating(true);
              setEditingEvent(null);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Novo Evento
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Create Form */}
          {isCreating && (
            <form onSubmit={handleCreateEvent} className="p-4 rounded-xl bg-slate-800/60 border border-emerald-500/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Cadastrar Novo Evento / Prova
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Evento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Meia Maratona de Verão 2026"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data da Prova
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 25/08/2026"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingLoading || !newName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {creatingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Salvar Evento
                </button>
              </div>
            </form>
          )}

          {/* Edit Form */}
          {editingEvent && (
            <form onSubmit={handleSaveEdit} className="p-4 rounded-xl bg-slate-800/60 border border-brand-500/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                  <Pencil className="w-4 h-4" /> Renomear / Editar Evento
                </span>
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Evento *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data da Prova
                  </label>
                  <input
                    type="text"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Atualizar Dados
                </button>
              </div>
            </form>
          )}

          {/* Events List */}
          {events.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/20">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300">Nenhum evento registrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Crie um evento acima ou anexe uma planilha para vincular automaticamente os atletas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {events.map((ev) => {
                const isActive = activeEventId === ev.$id;
                const total = ev.total_athletes || 0;
                const delivered = ev.delivered_athletes || 0;
                const pct = total > 0 ? ((delivered / total) * 100).toFixed(1) : "0";

                return (
                  <div
                    key={ev.$id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isActive
                        ? "bg-brand-950/30 border-brand-500/50 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/30"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white font-display">
                          {ev.name}
                        </h4>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500 text-white font-bold uppercase tracking-wider shadow-sm">
                            Evento Ativo
                          </span>
                        )}
                        {ev.event_date && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {ev.event_date}
                          </span>
                        )}
                      </div>

                      {/* Stats Indicators */}
                      <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-200">{total}</strong> atletas
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <strong className="text-emerald-400">{delivered}</strong> entregues
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!isActive ? (
                        <button
                          onClick={() => onSelectEvent(ev)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 hover:text-white text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Ativar
                        </button>
                      ) : (
                        <span className="text-xs text-brand-400 font-bold px-2 py-1 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Selecionado
                        </span>
                      )}

                      <button
                        onClick={() => {
                          setEditingEvent(ev);
                          setEditName(ev.name);
                          setEditDate(ev.event_date || "");
                          setEditLocation(ev.location || "");
                          setIsCreating(false);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-slate-800 transition-colors"
                        title="Renomear / Editar Evento"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setEventToDelete(ev)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Excluir Evento e seus Atletas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {eventToDelete && (
          <div className="p-4 bg-rose-950/30 border-t border-rose-500/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-300">
                  Excluir Tabela do Evento: "{eventToDelete.name}"?
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Esta ação excluirá permanentemente o evento e todos os seus <strong>{eventToDelete.total_athletes || 0} atletas</strong> vinculados. Os outros eventos não serão afetados.
                </p>

                {deletingLoading && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-rose-300 font-mono">
                      <span>Excluindo registros em lote...</span>
                      <span>{deleteProgress.current} / {deleteProgress.total}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full transition-all duration-200"
                        style={{ width: `${(deleteProgress.current / (deleteProgress.total || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    disabled={deletingLoading}
                    onClick={() => setEventToDelete(null)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={deletingLoading}
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30"
                  >
                    {deletingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-navy-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

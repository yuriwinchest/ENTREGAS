import React from "react";
import {
  Layers,
  Plus,
  Calendar,
  CheckCircle2,
  Users,
  Settings,
  Flame,
  FileSpreadsheet
} from "lucide-react";
import { EventItem } from "../types";

interface EventTabsBarProps {
  events: EventItem[];
  activeEvent: EventItem | null;
  onSelectEvent: (event: EventItem | null) => void;
  /** Opcionais: quando o usuário não tem a permissão, o botão nem aparece. */
  onOpenEventManager?: () => void;
  onOpenImportModal?: () => void;
}

export const EventTabsBar: React.FC<EventTabsBarProps> = ({
  events,
  activeEvent,
  onSelectEvent,
  onOpenEventManager,
  onOpenImportModal
}) => {
  // Total geral de todos os eventos somados
  const totalAllAthletes = events.reduce((acc, ev) => acc + (ev.total_athletes || 0), 0);
  const totalAllDelivered = events.reduce((acc, ev) => acc + (ev.delivered_athletes || 0), 0);

  return (
    <div className="w-full bg-slate-900/95 border-b border-slate-800/80 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar shadow-inner">
      {/* Container de Abas */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="hidden md:inline">Tabelas:</span>
        </div>

        {/* Aba: Todos os Eventos (Geral) */}
        <button
          onClick={() => onSelectEvent(null)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
            activeEvent === null
              ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/10"
              : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              activeEvent === null ? "bg-cyan-400 animate-pulse" : "bg-slate-600"
            }`}
          />
          <span>Todas as Tabelas (Geral)</span>
          {events.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeEvent === null
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-slate-700/60 text-slate-400"
              }`}
            >
              {totalAllAthletes} inscritos
            </span>
          )}
        </button>

        {/* Abas Individuais de Cada Evento / Planilha */}
        {events.map((event) => {
          const isActive = activeEvent?.$id === event.$id;
          const totalAthletes = event.total_athletes ?? 0;
          const deliveredAthletes = event.delivered_athletes ?? 0;
          const percentage =
            totalAthletes > 0 ? Math.round((deliveredAthletes / totalAthletes) * 100) : 0;

          return (
            <button
              key={event.$id}
              onClick={() => onSelectEvent(event)}
              className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border group ${
                isActive
                  ? "bg-slate-800 border-cyan-500 text-white shadow-md shadow-cyan-500/10"
                  : "bg-slate-800/40 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800/80 hover:border-slate-600"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isActive ? "bg-emerald-400 ring-2 ring-emerald-400/20" : "bg-slate-500"
                }`}
              />

              <span className="font-semibold max-w-[180px] truncate">{event.name}</span>

              {/* Badge de Contagem */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-slate-700/60 text-slate-300"
                  }`}
                  title={`${deliveredAthletes} de ${totalAthletes} kits entregues (${percentage}%)`}
                >
                  <Users className="w-3 h-3 text-cyan-400" />
                  <span>{totalAthletes}</span>
                  {deliveredAthletes > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold pl-1 border-l border-slate-600">
                      {deliveredAthletes} ({percentage}%)
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ações Rápidas no Canto Direito */}
      {(onOpenImportModal || onOpenEventManager) && (
        <div className="flex items-center gap-2 shrink-0 ml-auto pl-2 border-l border-slate-800">
          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-sm transition-all"
              title="Importar nova planilha Excel ou CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anexar Nova Tabela</span>
            </button>
          )}

          {onOpenEventManager && (
            <button
              onClick={onOpenEventManager}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
              title="Gerenciar Eventos e Tabelas"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

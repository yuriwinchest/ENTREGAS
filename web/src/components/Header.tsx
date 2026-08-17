import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Tv, 
  Users, 
  Settings, 
  Radio, 
  UserCheck, 
  Clock, 
  Layers,
  LogOut,
  ChevronDown,
  Calendar,
  SlidersHorizontal,
  FolderOpen
} from "lucide-react";
import { EventItem } from "../types";

interface HeaderProps {
  currentTab: "desk" | "telao" | "participants" | "settings";
  setCurrentTab: (tab: "desk" | "telao" | "participants" | "settings") => void;
  eventName: string;
  operatorName: string;
  setOperatorName: (name: string) => void;
  online: boolean;
  onLogout?: () => void;
  // Gestão de Eventos
  events?: EventItem[];
  activeEvent?: EventItem | null;
  onSelectEvent?: (event: EventItem | null) => void;
  onOpenEventManager?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  eventName,
  operatorName,
  setOperatorName,
  online,
  onLogout,
  events = [],
  activeEvent = null,
  onSelectEvent,
  onOpenEventManager
}) => {
  const [time, setTime] = useState<string>("");
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [tempOperator, setTempOperator] = useState(operatorName);
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const saveOperator = () => {
    const clean = tempOperator.trim() || "Operador";
    setOperatorName(clean);
    localStorage.setItem("chipower_operator", clean);
    setIsEditingOperator(false);
  };

  return (
    <header className="border-b border-slate-800/80 bg-navy-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Brand */}
          <div 
            onClick={() => setCurrentTab("desk")}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
            title="Voltar para a Operação de Balcão"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent">
                  CHIPOWER
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 font-mono font-medium">
                  KITS
                </span>
              </div>
            </div>
          </div>

          {/* Event Selector Widget */}
          {onSelectEvent && (
            <div className="relative hidden sm:block">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all max-w-[260px] truncate ${
                    activeEvent
                      ? "bg-brand-950/40 border-brand-500/40 text-brand-300 hover:bg-brand-900/40"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                  title="Clique para alternar o evento/tabela ativo"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  <span className="truncate font-display">
                    {activeEvent ? activeEvent.name : "Todos os Eventos"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </button>

                {onOpenEventManager && (
                  <button
                    type="button"
                    onClick={onOpenEventManager}
                    className="p-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Gerenciar Eventos e Tabelas (Renomear, Excluir, Criar)"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Event Dropdown Menu */}
              {isEventDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsEventDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-navy-900 border border-slate-700 shadow-2xl p-2 z-40 space-y-1 animate-scale-in">
                    <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Selecione a Tabela / Evento
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectEvent(null);
                        setIsEventDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                        !activeEvent ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span>Visão Geral (Todos os Eventos)</span>
                    </button>

                    {events.map((ev) => (
                      <button
                        key={ev.$id}
                        type="button"
                        onClick={() => {
                          onSelectEvent(ev);
                          setIsEventDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex flex-col gap-0.5 transition-colors ${
                          activeEvent?.$id === ev.$id
                            ? "bg-brand-500 text-white"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold">{ev.name}</span>
                          <span className="text-[10px] opacity-80 font-mono">
                            {ev.total_athletes || 0} atletas
                          </span>
                        </div>
                        {ev.event_date && (
                          <span className="text-[10px] opacity-70 font-mono">
                            {ev.event_date}
                          </span>
                        )}
                      </button>
                    ))}

                    {onOpenEventManager && (
                      <div className="pt-1 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEventDropdownOpen(false);
                            onOpenEventManager();
                          }}
                          className="w-full text-center px-3 py-1.5 rounded-xl text-xs font-bold text-brand-400 hover:bg-brand-500/10 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Gerenciar / Renomear Eventos
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              onClick={() => setCurrentTab("desk")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "desk"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Balcão
            </button>

            <button
              onClick={() => setCurrentTab("telao")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "telao"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              Telão TV
            </button>

            <button
              onClick={() => setCurrentTab("participants")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "participants"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Atletas & Tabelas
            </button>

            <button
              onClick={() => setCurrentTab("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "settings"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Configurações
            </button>
          </nav>

          {/* Right Status / Operator / Clock */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Clock */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{time}</span>
            </div>

            {/* Cloud Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="hidden sm:inline text-slate-300 font-medium">
                {online ? "Appwrite" : "Offline"}
              </span>
            </div>

            {/* Operator */}
            <div className="relative">
              {isEditingOperator ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempOperator}
                    onChange={(e) => setTempOperator(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveOperator()}
                    autoFocus
                    placeholder="Seu nome..."
                    className="w-24 sm:w-28 px-2 py-1 text-xs bg-slate-950 border border-brand-500 rounded-lg text-white outline-none"
                  />
                  <button
                    onClick={saveOperator}
                    className="px-2 py-1 bg-brand-500 text-white rounded-lg text-xs font-semibold"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setTempOperator(operatorName);
                    setIsEditingOperator(true);
                  }}
                  title="Clique para alterar operador"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/30 text-xs text-brand-300 hover:bg-brand-500/20 transition-all font-medium"
                >
                  <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                  <span className="max-w-[70px] sm:max-w-[90px] truncate">{operatorName}</span>
                </button>
              )}
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                title="Sair / Trocar de Conta"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 transition-all text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-semibold">Sair</span>
              </button>
            )}

          </div>
        </div>

        {/* Mobile Navigation Tabs & Event Info */}
        <div className="flex md:hidden items-center justify-between pb-2.5 pt-1 border-t border-slate-800/60 gap-1 overflow-x-auto">
          <button
            onClick={() => setCurrentTab("desk")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "desk" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Operação
          </button>
          <button
            onClick={() => setCurrentTab("telao")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "telao" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Telão
          </button>
          <button
            onClick={() => setCurrentTab("participants")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "participants" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Atletas
          </button>
          <button
            onClick={() => setCurrentTab("settings")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "settings" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Ajustes
          </button>

          {onOpenEventManager && (
            <button
              onClick={onOpenEventManager}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-brand-300 bg-brand-950/60 border border-brand-500/30 shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Eventos
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

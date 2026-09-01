import React, { useState, useEffect } from "react";
import {
  Zap,
  Tv,
  Users,
  Settings,
  Clock,
  Layers,
  LogOut,
  FolderOpen,
  UserCheck,
  Shield,
  Building2
} from "lucide-react";

export type HeaderTab = "desk" | "telao" | "participants" | "settings";

interface TabDefinition {
  key: HeaderTab;
  label: string;
  mobileLabel: string;
  icon: React.ReactNode;
}

const TABS: TabDefinition[] = [
  { key: "desk", label: "Balcão", mobileLabel: "Operação", icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "telao", label: "Telão TV", mobileLabel: "Telão", icon: <Tv className="w-3.5 h-3.5" /> },
  {
    key: "participants",
    label: "Atletas & Tabelas",
    mobileLabel: "Atletas",
    icon: <Users className="w-3.5 h-3.5" />
  },
  {
    key: "settings",
    label: "Configurações",
    mobileLabel: "Ajustes",
    icon: <Settings className="w-3.5 h-3.5" />
  }
];

interface HeaderProps {
  currentTab: HeaderTab;
  setCurrentTab: (tab: HeaderTab) => void;
  /** Abas liberadas para o usuário. As demais nem são desenhadas. */
  allowedTabs: HeaderTab[];
  operatorName: string;
  setOperatorName: (name: string) => void;
  online: boolean;
  onLogout?: () => void;
  onOpenUserManager?: () => void;
  onOpenEventManager?: () => void;
  tenantName?: string;
  roleLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  allowedTabs,
  operatorName,
  setOperatorName,
  online,
  onLogout,
  onOpenUserManager,
  onOpenEventManager,
  tenantName,
  roleLabel
}) => {
  const [time, setTime] = useState("");
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [tempOperator, setTempOperator] = useState(operatorName);

  useEffect(() => {
    const atualizar = () =>
      setTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );

    atualizar();
    const intervalo = setInterval(atualizar, 1000);
    return () => clearInterval(intervalo);
  }, []);

  const salvarOperador = () => {
    const limpo = tempOperator.trim() || "Operador";
    setOperatorName(limpo);
    localStorage.setItem("chipower_operator", limpo);
    setIsEditingOperator(false);
  };

  const abasVisiveis = TABS.filter((tab) => allowedTabs.includes(tab.key));

  return (
    <header className="border-b border-slate-800/80 bg-navy-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Marca e ambiente */}
          <div
            onClick={() => allowedTabs.includes("desk") && setCurrentTab("desk")}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
            title={tenantName ? `Ambiente: ${tenantName}` : "CHIPOWER"}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent">
                  CHIPOWER
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 font-mono font-medium">
                  KITS
                </span>
              </div>
              {tenantName && (
                <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-500 font-mono leading-none mt-0.5">
                  <Building2 className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[140px]">{tenantName}</span>
                </div>
              )}
            </div>
          </div>

          {/*
            O seletor de evento foi removido daqui de propósito: a barra de
            Tabelas, logo abaixo, já é o seletor — e é um seletor melhor, pois
            mostra o nome inteiro, a cor e o progresso de cada prova. Manter os
            dois criava duas fontes da mesma verdade lado a lado e empurrava o
            nome da tabela ativa para dentro de um "..." truncado.
          */}

          {/* Navegação principal */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            {abasVisiveis.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCurrentTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  currentTab === tab.key
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Status, operador e sessão */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{time}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
              />
              <span className="hidden sm:inline text-slate-300 font-medium">
                {online ? "Sincronizado" : "Offline"}
              </span>
            </div>

            <div className="relative">
              {isEditingOperator ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempOperator}
                    onChange={(e) => setTempOperator(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarOperador()}
                    autoFocus
                    placeholder="Seu nome..."
                    className="w-24 sm:w-28 px-2 py-1 text-xs bg-slate-950 border border-brand-500 rounded-lg text-white outline-none"
                  />
                  <button
                    onClick={salvarOperador}
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
                  title={roleLabel ? `${operatorName} — ${roleLabel}` : "Alterar nome exibido"}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/30 text-xs text-brand-300 hover:bg-brand-500/20 transition-all font-medium"
                >
                  {roleLabel === "Administrador" ? (
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                  )}
                  <span className="max-w-[70px] sm:max-w-[90px] truncate">{operatorName}</span>
                </button>
              )}
            </div>

            {onOpenUserManager && (
              <button
                onClick={onOpenUserManager}
                title="Gestão de equipe e permissões"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 transition-all text-xs font-semibold"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Equipe</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                title="Sair / trocar de conta"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 transition-all text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-semibold">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* Navegação mobile */}
        <div className="flex md:hidden items-center justify-between pb-2.5 pt-1 border-t border-slate-800/60 gap-1 overflow-x-auto">
          {abasVisiveis.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCurrentTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                currentTab === tab.key ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
              }`}
            >
              {tab.icon}
              {tab.mobileLabel}
            </button>
          ))}

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

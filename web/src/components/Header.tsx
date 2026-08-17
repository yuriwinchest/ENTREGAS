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
  LogOut
} from "lucide-react";

interface HeaderProps {
  currentTab: "desk" | "telao" | "participants" | "settings";
  setCurrentTab: (tab: "desk" | "telao" | "participants" | "settings") => void;
  eventName: string;
  operatorName: string;
  setOperatorName: (name: string) => void;
  online: boolean;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  eventName,
  operatorName,
  setOperatorName,
  online,
  onLogout
}) => {
  const [time, setTime] = useState<string>("");
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [tempOperator, setTempOperator] = useState(operatorName);

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
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Event */}
          <div 
            onClick={() => setCurrentTab("desk")}
            className="flex items-center gap-3 cursor-pointer group"
            title="Voltar para a Operação de Balcão"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent group-hover:opacity-90">
                  CHIPOWER
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 font-mono font-medium">
                  KITS CLOUD
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs font-medium group-hover:text-slate-300">
                {eventName || "Entrega Oficial de Kits"}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              onClick={() => setCurrentTab("desk")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "desk"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Layers className="w-4 h-4" />
              Operação de Balcão
            </button>

            <button
              onClick={() => setCurrentTab("telao")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "telao"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Tv className="w-4 h-4" />
              Telão TV ao Vivo
            </button>

            <button
              onClick={() => setCurrentTab("participants")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "participants"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Users className="w-4 h-4" />
              Atletas & Importação
            </button>

            <button
              onClick={() => setCurrentTab("settings")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "settings"
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurações
            </button>
          </nav>

          {/* Right Status / Operator / Clock */}
          <div className="flex items-center gap-3">
            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{time}</span>
            </div>

            {/* Cloud Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="hidden sm:inline text-slate-300 font-medium">
                {online ? "Appwrite Nuvem" : "Offline"}
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
                    className="w-28 px-2 py-1 text-xs bg-slate-950 border border-brand-500 rounded-lg text-white outline-none"
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
                  <span className="max-w-[90px] truncate">{operatorName}</span>
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

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center justify-between pb-3 pt-1 border-t border-slate-800/60 gap-1 overflow-x-auto">
          <button
            onClick={() => setCurrentTab("desk")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "desk" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Operação
          </button>
          <button
            onClick={() => setCurrentTab("telao")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "telao" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Telão
          </button>
          <button
            onClick={() => setCurrentTab("participants")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "participants" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Atletas
          </button>
          <button
            onClick={() => setCurrentTab("settings")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
              currentTab === "settings" ? "bg-brand-500 text-white" : "text-slate-400 bg-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Ajustes
          </button>
        </div>
      </div>
    </header>
  );
};

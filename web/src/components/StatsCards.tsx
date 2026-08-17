import React from "react";
import { Users, CheckCircle2, Clock, Activity, TrendingUp, FolderOpen } from "lucide-react";
import { DeliveryStats } from "../types";

interface StatsCardsProps {
  stats: DeliveryStats;
  activeEventName?: string | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, activeEventName }) => {
  return (
    <div className="space-y-2">
      {/* Active Event Indicator Banner */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <FolderOpen className="w-3.5 h-3.5 text-brand-400" />
          <span>Filtro de Estatísticas:</span>
          <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md font-mono">
            {activeEventName || "Todas as Tabelas / Eventos (Geral)"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Inscritos
            </span>
            <div className="p-2 rounded-xl bg-slate-800/80 text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black font-display text-white">
              {stats.total.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-slate-400 font-mono">100% Base</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800" />
        </div>

        {/* Entregues Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Kits Entregues
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black font-display text-emerald-400">
              {stats.delivered.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {stats.percentage}%
            </span>
          </div>
          {/* Progress bar background */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500 rounded-full shadow-sm shadow-emerald-500/50"
              style={{ width: `${Math.min(100, stats.percentage)}%` }}
            />
          </div>
        </div>

        {/* Pendentes Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Kits Pendentes
            </span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black font-display text-amber-400">
              {stats.pending.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs font-mono text-amber-400/80">
              {stats.total > 0 ? (100 - stats.percentage).toFixed(1) : 0}%
            </span>
          </div>
          {/* Progress bar background */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-amber-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${Math.max(0, 100 - stats.percentage)}%` }}
            />
          </div>
        </div>

        {/* Ritmo / Performance Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group border-brand-500/20 bg-brand-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              Status da Operação
            </span>
            <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping" />
              <span className="text-xl sm:text-2xl font-black font-display text-white">
                Ao Vivo
              </span>
            </div>
            <span className="text-xs text-brand-400/80 font-mono">
              Nuvem Ativa
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-brand-500 h-full w-full opacity-60" />
          </div>
        </div>
      </div>
    </div>
  );
};

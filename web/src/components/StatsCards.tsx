import React from "react";
import { Users, CheckCircle2, Clock } from "lucide-react";
import { DeliveryStats } from "../types";

interface StatsCardsProps {
  stats: DeliveryStats;
  /** Mantido por compatibilidade: a tabela ativa já é indicada pela aba acesa. */
  activeEventName?: string | null;
}

/**
 * Resumo numérico da operação.
 *
 * O QUE MUDOU E POR QUÊ: eram quatro cartões grandes, cada um com ícone,
 * rótulo em caixa alta e barra de progresso própria. Três problemas reais:
 *
 *  1. A barra dos "pendentes" era o inverso exato da barra dos "entregues" —
 *     a mesma informação desenhada duas vezes, competindo pela atenção.
 *  2. O cartão "Status da Operação / Ao Vivo" não trazia número nenhum e
 *     repetia o indicador de sincronização que já vive no cabeçalho.
 *  3. A faixa "Filtro de Estatísticas" anunciava a tabela ativa, sendo que a
 *     aba correspondente logo acima já está acesa, com cor e anel próprios.
 *
 * Agora é uma faixa só, com os três números que o operador de fato usa e uma
 * única barra de progresso. Sobram cerca de 100px de altura, e a busca — o
 * campo mais usado da tela — sobe para perto do topo.
 */

interface NumeroProps {
  rotulo: string;
  valor: number;
  sufixo?: string;
  icone: React.ReactNode;
  cor: string;
  corRotulo: string;
}

const Numero: React.FC<NumeroProps> = ({ rotulo, valor, sufixo, icone, cor, corRotulo }) => (
  <div className="px-4 sm:px-5 py-3.5 flex flex-col gap-1 min-w-0">
    <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${corRotulo}`}>
      {icone}
      {rotulo}
    </span>
    <div className="flex items-baseline gap-2 min-w-0">
      <span className={`text-2xl sm:text-3xl font-black font-display leading-none ${cor}`}>
        {valor.toLocaleString("pt-BR")}
      </span>
      {sufixo && <span className={`text-xs font-mono ${corRotulo}`}>{sufixo}</span>}
    </div>
  </div>
);

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const restante = stats.total > 0 ? (100 - stats.percentage).toFixed(1) : "0";

  return (
    <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-slate-800/80">
        <Numero
          rotulo="Inscritos"
          valor={stats.total}
          icone={<Users className="w-3.5 h-3.5" />}
          cor="text-white"
          corRotulo="text-slate-400"
        />
        <Numero
          rotulo="Entregues"
          valor={stats.delivered}
          sufixo={`${stats.percentage}%`}
          icone={<CheckCircle2 className="w-3.5 h-3.5" />}
          cor="text-emerald-400"
          corRotulo="text-emerald-500/80"
        />
        <Numero
          rotulo="Pendentes"
          valor={stats.pending}
          sufixo={`${restante}%`}
          icone={<Clock className="w-3.5 h-3.5" />}
          cor="text-amber-400"
          corRotulo="text-amber-500/80"
        />
      </div>

      {/* Uma barra só: o que falta é simplesmente o trecho não preenchido. */}
      <div className="h-1.5 w-full bg-slate-800/90" role="presentation">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${Math.min(100, stats.percentage)}%` }}
        />
      </div>
    </div>
  );
};

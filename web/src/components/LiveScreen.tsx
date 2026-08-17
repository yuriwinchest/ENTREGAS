import { 
  Zap, 
  Maximize2, 
  Minimize2, 
  Clock, 
  CheckCircle2, 
  Shirt, 
  Award, 
  Users, 
  Sparkles,
  ArrowLeft,
  LayoutDashboard
} from "lucide-react";
import { Participant, DeliveryStats } from "../types";

interface LiveScreenProps {
  eventName: string;
  stats: DeliveryStats;
  recentDeliveries: Participant[];
  onExit: () => void;
}

export const LiveScreen: React.FC<LiveScreenProps> = ({
  eventName,
  stats,
  recentDeliveries,
  onExit
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [time, setTime] = useState("");

  // Atalho de teclado ESC para voltar ao painel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        onExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  const latestAthlete = recentDeliveries[0] || null;

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans select-none">
      
      {/* Top Bar Telão */}
      <header className="flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div 
          onClick={onExit}
          className="flex items-center gap-4 cursor-pointer group transition-all"
          title="Clique para voltar à Operação de Balcão"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-brand-500/30 group-hover:scale-105 transition-transform">
            <Zap className="w-8 h-8 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent group-hover:opacity-90">
                CHIPOWER
              </h1>
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/40 text-xs font-mono font-bold">
                TELÃO AO VIVO
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-400 font-medium group-hover:text-slate-300">
              {eventName || "Entrega Oficial de Kits"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Botão de Retorno em Destaque */}
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-brand-600 hover:to-amber-600 border border-slate-700 hover:border-brand-400 text-slate-200 hover:text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-black/40 hover:shadow-brand-500/20"
            title="Voltar para a Operação de Balcão (ESC)"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Voltar ao Balcão</span>
          </button>

          {/* Relógio Gigante */}
          <div className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 font-mono text-xl sm:text-2xl font-bold text-brand-400 shadow-inner">
            <Clock className="w-6 h-6" />
            <span>{time}</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
            title="Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Corpo Principal: Destaque do Último Atleta + Grade Recente */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6 flex-1 items-stretch">
        
        {/* Coluna 1: Grande Chamada da Última Retirada (Destaque TV) */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          {latestAthlete ? (
            <div className="glass-card rounded-3xl p-8 sm:p-10 border-2 border-brand-500/50 bg-gradient-to-b from-brand-950/40 to-slate-900/90 shadow-2xl relative overflow-hidden glow-orange animate-scale-in">
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs sm:text-sm">
                  <CheckCircle2 className="w-5 h-5 animate-pulse" />
                  <span>Último Kit Retirado com Sucesso</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Agora mesmo</span>
                </div>
              </div>

              {/* Número e Nome Gigantes */}
              <div className="my-8 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-brand-600 to-amber-500 flex flex-col items-center justify-center text-white shadow-2xl shadow-brand-500/40 shrink-0">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider opacity-80">PEITO</span>
                  <span className="text-4xl sm:text-5xl font-black font-display">
                    {latestAthlete.bib_number}
                  </span>
                </div>

                <div className="min-w-0">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight leading-none truncate">
                    {latestAthlete.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-sm sm:text-base text-slate-300">
                    <span className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 font-semibold">
                      {latestAthlete.modality || "Geral"}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 font-semibold">
                      {latestAthlete.category || "Geral"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Destaque de Camiseta */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-between text-amber-300">
                <div className="flex items-center gap-3">
                  <Shirt className="w-7 h-7 text-amber-400" />
                  <span className="font-bold text-sm sm:text-base uppercase tracking-wider">
                    Camiseta Oficial Entregue
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-black font-display bg-amber-500/20 px-4 py-1.5 rounded-xl border border-amber-500/50">
                  {latestAthlete.shirt || "Padrão"}
                </span>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-12 border border-slate-800 text-center flex flex-col items-center justify-center h-full">
              <Zap className="w-16 h-16 text-brand-500/40 mb-4 animate-pulse" />
              <h3 className="text-2xl font-bold text-slate-300">
                Painel da Tenda de Entrega
              </h3>
              <p className="text-slate-500 mt-2">
                Os kits retirados pelos atletas aparecerão aqui em tempo real.
              </p>
            </div>
          )}
        </div>

        {/* Coluna 2: Lista dos Últimos 8 Retirados */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="glass-card rounded-3xl p-6 border border-slate-800 flex-1 flex flex-col">
            <h3 className="text-lg font-bold text-white flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-400" />
                Retiradas Recentes
              </span>
              <span className="text-xs font-mono text-slate-400">
                Balcão Oficial
              </span>
            </h3>

            <div className="mt-4 divide-y divide-slate-800/80 overflow-hidden flex-1 flex flex-col justify-around">
              {recentDeliveries.slice(0, 7).map((athlete, idx) => (
                <div key={athlete.$id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm shrink-0 ${
                      idx === 0
                        ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                        : "bg-slate-900 border border-slate-800 text-emerald-400"
                    }`}>
                      {athlete.bib_number}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm sm:text-base text-white truncate">
                        {athlete.name}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {athlete.modality || "Geral"} • Camiseta: <strong className="text-amber-400">{athlete.shirt || "-"}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono shrink-0">
                    {athlete.delivered_at ? new Date(athlete.delivered_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "OK"}
                  </span>
                </div>
              ))}

              {recentDeliveries.length === 0 && (
                <p className="text-slate-500 text-center py-8 text-sm">
                  Aguardando primeiras entregas...
                </p>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Ticker Inferior: Estatísticas Globais ao Vivo */}
      <footer className="pt-6 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total Atletas</span>
            <span className="text-2xl sm:text-3xl font-black font-display text-white">{stats.total}</span>
          </div>
          <Users className="w-8 h-8 text-slate-600" />
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">Kits Entregues</span>
            <span className="text-2xl sm:text-3xl font-black font-display text-emerald-400">{stats.delivered}</span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
        </div>

        <div className="glass-card rounded-2xl p-4 border border-amber-500/30 bg-amber-950/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">Kits Pendentes</span>
            <span className="text-2xl sm:text-3xl font-black font-display text-amber-400">{stats.pending}</span>
          </div>
          <Clock className="w-8 h-8 text-amber-500/60" />
        </div>

        <div className="glass-card rounded-2xl p-4 border border-brand-500/30 bg-brand-950/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400 block">Progresso Global</span>
            <span className="text-2xl sm:text-3xl font-black font-display text-brand-400">{stats.percentage}%</span>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-brand-500 flex items-center justify-center font-bold text-xs">
            {stats.percentage}%
          </div>
        </div>

      </footer>

    </div>
  );
};

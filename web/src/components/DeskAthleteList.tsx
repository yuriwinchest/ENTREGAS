import React, { useCallback, useEffect, useRef, useState } from "react";
import { Users, Loader2, Check, Clock, ListFilter, RefreshCw, ChevronDown } from "lucide-react";
import { Participant, EventItem } from "../types";
import { api } from "../lib/appwrite";

type Filtro = "pending" | "delivered" | "all";

interface DeskAthleteListProps {
  activeEvent: EventItem | null;
  /** Recarrega quando muda — usado após confirmar uma entrega. */
  versao: number;
  onSelecionar: (atleta: Participant) => void;
}

const PAGINA = 50;

const FILTROS: Array<{ chave: Filtro; rotulo: string; icone: React.ReactNode }> = [
  { chave: "pending", rotulo: "Pendentes", icone: <Clock className="w-3.5 h-3.5" /> },
  { chave: "delivered", rotulo: "Entregues", icone: <Check className="w-3.5 h-3.5" /> },
  { chave: "all", rotulo: "Todos", icone: <ListFilter className="w-3.5 h-3.5" /> }
];

/**
 * Lista de atletas dentro do Balcão.
 *
 * O Balcão só tinha busca: sem digitar nada, a tela ficava vazia esperando.
 * Isso funciona para quem chega sabendo o número de peito, mas trava o
 * atendimento de quem chega sem saber — o operador não tinha por onde começar.
 *
 * A lista abre já nos PENDENTES, que é a fila real de trabalho, e cada linha
 * leva direto para a confirmação da entrega.
 */
export const DeskAthleteList: React.FC<DeskAthleteListProps> = ({
  activeEvent,
  versao,
  onSelecionar
}) => {
  const [atletas, setAtletas] = useState<Participant[]>([]);
  const [total, setTotal] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("pending");
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);

  // Descarta respostas fora de ordem ao alternar filtro rapidamente.
  const requisicao = useRef(0);

  const carregar = useCallback(
    async (numeroDaPagina: number, filtroAtual: Filtro, acumular: boolean) => {
      const id = ++requisicao.current;
      setCarregando(true);

      try {
        const res = await api.listParticipants({
          limit: PAGINA,
          offset: numeroDaPagina * PAGINA,
          pendingOnly: filtroAtual === "pending",
          deliveredOnly: filtroAtual === "delivered",
          eventId: activeEvent ? activeEvent.$id : undefined
        });

        if (id !== requisicao.current) return;

        setAtletas((anteriores) => (acumular ? [...anteriores, ...res.documents] : res.documents));
        setTotal(res.total);
      } catch (err) {
        console.error("Erro ao carregar a lista do balcão:", err);
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    },
    [activeEvent]
  );

  useEffect(() => {
    setPagina(0);
    void carregar(0, filtro, false);
  }, [carregar, filtro, versao]);

  const carregarMais = () => {
    const proxima = pagina + 1;
    setPagina(proxima);
    void carregar(proxima, filtro, true);
  };

  const temMais = atletas.length < total;

  return (
    <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-bold text-white">
            {activeEvent ? activeEvent.name : "Todas as Tabelas"}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {total} {filtro === "pending" ? "pendente(s)" : filtro === "delivered" ? "entregue(s)" : "atleta(s)"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {FILTROS.map((item) => (
            <button
              key={item.chave}
              onClick={() => setFiltro(item.chave)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                filtro === item.chave
                  ? "bg-brand-500/20 border-brand-500/50 text-brand-200"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}

          <button
            onClick={() => {
              setPagina(0);
              void carregar(0, filtro, false);
            }}
            title="Atualizar lista"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {carregando && atletas.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando atletas...
        </div>
      ) : atletas.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          {filtro === "pending"
            ? "Nenhum kit pendente nesta tabela. Tudo entregue."
            : filtro === "delivered"
              ? "Nenhum kit entregue ainda."
              : "Nenhum atleta nesta tabela."}
        </div>
      ) : (
        <>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800/70">
            {atletas.map((atleta) => (
              <button
                key={atleta.$id}
                onClick={() => onSelecionar(atleta)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/60 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center font-display font-black text-brand-400 shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-all">
                    {atleta.bib_number}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm truncate group-hover:text-brand-300">
                      {atleta.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{atleta.modality || "Geral"}</span>
                      {atleta.shirt && (
                        <>
                          <span>•</span>
                          <span>Camisa {atleta.shirt}</span>
                        </>
                      )}
                      {atleta.cpf && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{atleta.cpf}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {atleta.delivered_at ? (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-semibold border border-rose-500/30 shrink-0 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Entregue
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 shrink-0">
                    Pendente
                  </span>
                )}
              </button>
            ))}
          </div>

          {temMais && (
            <button
              onClick={carregarMais}
              disabled={carregando}
              className="w-full py-3 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 border-t border-slate-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Carregar mais ({atletas.length} de {total})
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};

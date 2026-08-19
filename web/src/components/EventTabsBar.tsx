import React, { useEffect, useMemo, useState } from "react";
import {
  Layers,
  Users,
  Settings,
  FileSpreadsheet,
  ChevronDown,
  Paperclip,
  Loader2,
  Calendar,
  CheckCircle2
} from "lucide-react";
import { EventItem, ImportBatch } from "../types";
import { api } from "../lib/appwrite";
import { paletasParaEventos, iniciaisDoEvento, PALETA_GERAL } from "../lib/eventColors";

interface EventTabsBarProps {
  events: EventItem[];
  activeEvent: EventItem | null;
  onSelectEvent: (event: EventItem | null) => void;
  /** Opcionais: sem a permissão, o botão nem aparece. */
  onOpenEventManager?: () => void;
  onOpenImportModal?: () => void;
}

const formatarData = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Barra de navegação entre as tabelas de eventos.
 *
 * Três coisas que a versão anterior não deixava claro e agora deixa:
 *
 *  1. QUAL É QUAL — todas as abas tinham a mesma cor. Agora cada evento tem
 *     uma cor fixa própria, com sigla e bolinha, e a aba selecionada ganha
 *     borda acesa e uma faixa embaixo ligando-a ao conteúdo da tela.
 *
 *  2. COMO ESTÁ CADA UMA — barra de progresso de entrega dentro da própria
 *     aba, sem precisar trocar de tabela para descobrir.
 *
 *  3. DE ONDE VIERAM OS DADOS — anexar mais uma planilha a um evento NÃO cria
 *     aba nova, os atletas entram na mesma tabela. Quando isso acontece a aba
 *     mostra o número de anexos e pode ser expandida para listar cada planilha,
 *     com data, quem anexou e quantos entraram.
 */
export const EventTabsBar: React.FC<EventTabsBarProps> = ({
  events,
  activeEvent,
  onSelectEvent,
  onOpenEventManager,
  onOpenImportModal
}) => {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<ImportBatch[]>([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);
  const [contagemDeAnexos, setContagemDeAnexos] = useState<Record<string, number>>({});

  // Cores atribuídas em conjunto para não repetir entre as provas visíveis.
  const paletas = useMemo(() => paletasParaEventos(events.map((e) => e.$id)), [events]);

  const totalGeral = events.reduce((acc, ev) => acc + (ev.total_athletes || 0), 0);
  const entregueGeral = events.reduce((acc, ev) => acc + (ev.delivered_athletes || 0), 0);

  // Quantos anexos cada evento recebeu — alimenta o selo "2 planilhas".
  useEffect(() => {
    const ids = events.map((e) => e.$id);
    if (ids.length === 0) {
      setContagemDeAnexos({});
      return;
    }
    void api.contarPorEvento(ids).then(setContagemDeAnexos);
  }, [events]);

  const alternarExpansao = async (eventId: string) => {
    if (expandido === eventId) {
      setExpandido(null);
      return;
    }

    setExpandido(eventId);
    setCarregandoAnexos(true);
    try {
      setAnexos(await api.listarPorEvento(eventId));
    } finally {
      setCarregandoAnexos(false);
    }
  };

  return (
    <div className="w-full bg-slate-900/95 border-b border-slate-800/80 backdrop-blur-md shadow-inner">
      <div className="px-4 sm:px-6 py-2.5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar pb-1 pr-2">
          <div className="flex items-center gap-1.5 pr-2.5 mr-1 border-r border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider self-stretch shrink-0">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline">Tabelas</span>
          </div>

          {/* Visão geral de todas as tabelas */}
          <button
            onClick={() => onSelectEvent(null)}
            className={`relative shrink-0 rounded-xl border px-3.5 py-2 text-left transition-all ${
              activeEvent === null
                ? `${PALETA_GERAL.ativoFundo} ${PALETA_GERAL.ativoBorda} ring-2`
                : `${PALETA_GERAL.inativoFundo} ${PALETA_GERAL.inativoBorda}`
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${PALETA_GERAL.ponto}`} />
              <span
                className={`text-xs font-bold ${activeEvent === null ? "text-white" : "text-slate-300"}`}
              >
                Todas as Tabelas
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {totalGeral} inscritos
              {entregueGeral > 0 && <span className="text-emerald-400"> · {entregueGeral} entregues</span>}
            </div>

            {activeEvent === null && (
              <span
                className={`absolute -bottom-[11px] left-3 right-3 h-[3px] rounded-t ${PALETA_GERAL.faixa}`}
              />
            )}
          </button>

          {/* Uma aba por evento, cada uma com sua cor fixa */}
          {events.map((event) => {
            const ativo = activeEvent?.$id === event.$id;
            const paleta = paletas[event.$id] || PALETA_GERAL;
            const total = event.total_athletes ?? 0;
            const entregues = event.delivered_athletes ?? 0;
            const percentual = total > 0 ? Math.round((entregues / total) * 100) : 0;
            const quantosAnexos = contagemDeAnexos[event.$id] || 0;

            return (
              // O selo de anexos fica FORA do botão da aba de propósito: elemento
              // clicável dentro de <button> é aninhamento inválido e o navegador
              // engolia o clique, deixando a expansão sem responder.
              <div key={event.$id} className="relative shrink-0 flex items-stretch">
                <button
                  onClick={() => onSelectEvent(event)}
                  title={`${event.name} — ${entregues} de ${total} kits entregues`}
                  className={`rounded-xl border px-3 py-2 text-left transition-all ${
                    quantosAnexos > 1 ? "rounded-r-none border-r-0" : ""
                  } ${
                    ativo
                      ? `${paleta.ativoFundo} ${paleta.ativoBorda} ring-2`
                      : `${paleta.inativoFundo} ${paleta.inativoBorda}`
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Sigla colorida: identifica a prova antes mesmo de ler o nome */}
                    <span
                      className={`min-w-[26px] h-6 px-1 rounded-md flex items-center justify-center text-[10px] font-black text-slate-950 shrink-0 tracking-tight ${paleta.ponto}`}
                    >
                      {iniciaisDoEvento(event.name)}
                    </span>

                    {/* Nome completo em até duas linhas: truncar em 190px
                        escondia justamente o que diferencia as tabelas. */}
                    <span
                      className={`text-xs font-bold leading-tight max-w-[260px] line-clamp-2 ${
                        ativo ? paleta.ativoTexto : "text-slate-300"
                      }`}
                    >
                      {event.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 rounded-full bg-slate-950/80 overflow-hidden min-w-[70px]">
                      <div
                        className={`h-full rounded-full transition-all ${paleta.barra}`}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      <Users className="w-2.5 h-2.5 inline mb-px" /> {total}
                      {entregues > 0 && (
                        <span className="text-emerald-400 font-semibold"> · {percentual}%</span>
                      )}
                    </span>
                  </div>

                  {ativo && (
                    <span
                      className={`absolute -bottom-[11px] left-3 right-3 h-[3px] rounded-t ${paleta.faixa}`}
                    />
                  )}
                </button>

                {/* Tabela que recebeu mais de uma planilha: abre o histórico */}
                {quantosAnexos > 1 && (
                  <button
                    onClick={() => void alternarExpansao(event.$id)}
                    title={`${quantosAnexos} planilhas foram anexadas a esta tabela — clique para ver`}
                    className={`rounded-xl rounded-l-none border border-l border-l-slate-700/50 px-2 flex flex-col items-center justify-center gap-0.5 transition-all ${
                      expandido === event.$id
                        ? `${paleta.ativoFundo} ${paleta.ativoBorda}`
                        : `${paleta.inativoFundo} ${paleta.inativoBorda}`
                    }`}
                  >
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-300">
                      <Paperclip className="w-2.5 h-2.5" />
                      {quantosAnexos}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-slate-400 transition-transform ${
                        expandido === event.$id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {(onOpenImportModal || onOpenEventManager) && (
          <div className="flex items-center gap-2 shrink-0 pl-3 ml-1 border-l border-slate-800 self-center">
            {onOpenImportModal && (
              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-sm transition-all"
                title="Anexar uma planilha: pode criar uma tabela nova ou somar a uma existente"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anexar Planilha</span>
              </button>
            )}

            {onOpenEventManager && (
              <button
                onClick={onOpenEventManager}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
                title="Gerenciar eventos e tabelas"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Histórico de planilhas do evento expandido */}
      {expandido && (
        <div className="px-4 sm:px-6 pb-3 -mt-0.5">
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              <Paperclip className="w-3 h-3" />
              Planilhas anexadas a esta tabela
            </div>

            {carregandoAnexos ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando histórico...
              </div>
            ) : anexos.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">
                Nenhum anexo registrado. O histórico começa a partir das próximas importações.
              </p>
            ) : (
              <div className="space-y-1.5">
                {anexos.map((anexo, indice) => (
                  <div
                    key={anexo.$id}
                    className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {anexos.length - indice}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs text-slate-200 font-medium truncate">
                          {anexo.file_name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatarData(anexo.$createdAt)}
                          {anexo.owner_name && <span>· por {anexo.owner_name}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />+{anexo.inserted}
                      </span>
                      {anexo.updated > 0 && (
                        <span className="text-amber-400">{anexo.updated} atualizados</span>
                      )}
                      {anexo.skipped > 0 && (
                        <span className="text-slate-500">{anexo.skipped} já existiam</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

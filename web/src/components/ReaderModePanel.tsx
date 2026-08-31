import React, { useCallback, useRef, useState } from "react";
import { Radio, RadioTower, CheckCircle2, AlertTriangle, XCircle, Loader2, Power } from "lucide-react";
import { Participant, EventItem } from "../types";
import { api } from "../lib/appwrite";
import { sounds } from "../lib/audio";
import { useTagReader } from "../hooks/useTagReader";

type Veredito = "pendente" | "ja_entregue" | "nao_encontrado";

interface ResultadoDaLeitura {
  veredito: Veredito;
  codigo: string;
  atleta: Participant | null;
  quando: number;
}

interface ReaderModePanelProps {
  activeEvent: EventItem | null;
  /** Leva o atleta lido para a tela de confirmação de entrega. */
  onSelecionar: (atleta: Participant) => void;
  /**
   * Falso enquanto já existe um atleta aberto na tela.
   *
   * Sem essa trava, alguém passando perto da antena trocaria o atleta que o
   * operador está conferindo — e a entrega seria confirmada para a pessoa
   * errada. Nesse caso a leitura ainda aparece com seu veredito, mas não
   * sequestra a tela.
   */
  podeSelecionar: boolean;
}

/**
 * Modo Leitora: valida o kit quando o atleta passa pela antena.
 *
 * É o fluxo que substitui a conferência manual — em vez de o operador procurar
 * a pessoa na lista, a tag é lida e o sistema responde na hora se aquele kit
 * já saiu ou não.
 *
 * A leitura NÃO confirma a entrega sozinha, de propósito: alguém passando perto
 * da antena sem retirar o kit ficaria marcado como atendido. O que a leitura faz
 * é trazer o atleta e o veredito; quem confirma é o operador.
 */
export const ReaderModePanel: React.FC<ReaderModePanelProps> = ({
  activeEvent,
  onSelecionar,
  podeSelecionar
}) => {
  const [ligado, setLigado] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [historico, setHistorico] = useState<ResultadoDaLeitura[]>([]);

  // Evita consultas empilhadas quando várias tags entram em sequência.
  const emAndamento = useRef(false);

  // Lido dentro do callback sem recriá-lo a cada render.
  const podeSelecionarRef = useRef(podeSelecionar);
  podeSelecionarRef.current = podeSelecionar;

  const processarLeitura = useCallback(
    async (codigo: string) => {
      if (emAndamento.current) return;
      emAndamento.current = true;
      setConsultando(true);

      try {
        const eventId = activeEvent ? activeEvent.$id : undefined;

        // A tag pode estar gravada como chip, número de peito ou QR.
        const atleta =
          (await api.findParticipantByChip(codigo, eventId)) ||
          (await api.findParticipantByNumber(codigo, eventId)) ||
          (await api.findParticipantByQr(codigo, eventId));

        const veredito: Veredito = !atleta
          ? "nao_encontrado"
          : atleta.delivered_at
            ? "ja_entregue"
            : "pendente";

        if (veredito === "pendente") sounds.playSuccess();
        else sounds.playWarning();

        setHistorico((anteriores) =>
          [{ veredito, codigo, atleta, quando: Date.now() }, ...anteriores].slice(0, 12)
        );

        // Kit ainda não entregue: abre a confirmação, desde que a tela esteja
        // livre — nunca por cima de um atleta que o operador já está conferindo.
        if (atleta && veredito === "pendente" && podeSelecionarRef.current) onSelecionar(atleta);
      } catch (err) {
        console.error("Falha ao consultar a tag lida:", err);
      } finally {
        emAndamento.current = false;
        setConsultando(false);
      }
    },
    [activeEvent, onSelecionar]
  );

  const { ultimoCodigo, totalDeLeituras, recebendo } = useTagReader({
    ativo: ligado,
    onLeitura: processarLeitura
  });

  const ultimo = historico[0];

  const estiloDoVeredito = (veredito: Veredito) =>
    veredito === "pendente"
      ? { fundo: "bg-emerald-500/10 border-emerald-500/40", texto: "text-emerald-300", icone: <CheckCircle2 className="w-5 h-5" /> }
      : veredito === "ja_entregue"
        ? { fundo: "bg-rose-500/10 border-rose-500/40", texto: "text-rose-300", icone: <AlertTriangle className="w-5 h-5" /> }
        : { fundo: "bg-slate-800/60 border-slate-700", texto: "text-slate-300", icone: <XCircle className="w-5 h-5" /> };

  return (
    <div
      className={`glass-card rounded-2xl border transition-all ${
        ligado ? "border-brand-500/50 bg-brand-950/20" : "border-slate-800/80"
      }`}
    >
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
              ligado
                ? `bg-brand-500/20 border-brand-500/50 text-brand-300 ${recebendo ? "scale-110" : ""}`
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
          >
            {ligado ? <RadioTower className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
          </div>

          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Modo Leitora
              {ligado && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ESCUTANDO
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {ligado
                ? "Passe a tag na antena — o sistema informa se o kit já saiu"
                : "Ative para validar os kits pela leitora, sem procurar na lista"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setLigado((v) => !v)}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
            ligado
              ? "bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25"
              : "bg-gradient-to-r from-brand-500 to-amber-500 border-transparent text-white hover:from-brand-600 hover:to-amber-600"
          }`}
        >
          <Power className="w-4 h-4" />
          {ligado ? "Desativar" : "Ativar leitora"}
        </button>
      </div>

      {ligado && (
        <div className="p-4 space-y-3">
          {!podeSelecionar && (
            <div className="px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-[11px] text-slate-300">
              Há um atleta aberto na tela. As leituras continuam sendo validadas aqui, mas só trocam de
              atleta depois que você concluir ou fechar o atendimento atual.
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>
              Tabela: <strong className="text-slate-200">{activeEvent ? activeEvent.name : "Todas"}</strong>
            </span>
            <span className="flex items-center gap-2">
              {consultando && <Loader2 className="w-3 h-3 animate-spin text-brand-400" />}
              {totalDeLeituras} leitura(s)
              {ultimoCodigo && <span className="text-slate-500">· última: {ultimoCodigo}</span>}
            </span>
          </div>

          {!ultimo ? (
            <div className="py-8 text-center">
              <RadioTower
                className={`w-10 h-10 mx-auto mb-2 ${recebendo ? "text-brand-400" : "text-slate-600"}`}
              />
              <p className="text-sm text-slate-400">Aguardando a primeira tag...</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Não é preciso clicar em nada. A leitura é capturada mesmo sem campo selecionado.
              </p>
            </div>
          ) : (
            <>
              {/* Veredito da última tag lida */}
              <div className={`p-4 rounded-xl border ${estiloDoVeredito(ultimo.veredito).fundo}`}>
                <div className={`flex items-center gap-2 ${estiloDoVeredito(ultimo.veredito).texto}`}>
                  {estiloDoVeredito(ultimo.veredito).icone}
                  <span className="font-bold text-sm">
                    {ultimo.veredito === "pendente"
                      ? "KIT PENDENTE — pode entregar"
                      : ultimo.veredito === "ja_entregue"
                        ? "ATENÇÃO: ESTE KIT JÁ FOI ENTREGUE"
                        : "TAG NÃO ENCONTRADA NESTA TABELA"}
                  </span>
                </div>

                {ultimo.atleta ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-black text-white text-lg">
                        #{ultimo.atleta.bib_number} — {ultimo.atleta.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {ultimo.atleta.modality || "Geral"}
                        {ultimo.atleta.shirt && ` · Camisa ${ultimo.atleta.shirt}`}
                        {ultimo.atleta.delivered_at &&
                          ` · retirado em ${new Date(ultimo.atleta.delivered_at).toLocaleString("pt-BR")}`}
                        {ultimo.atleta.receiver_name && ` por ${ultimo.atleta.receiver_name}`}
                      </div>
                    </div>

                    {ultimo.veredito === "ja_entregue" && (
                      <button
                        onClick={() => onSelecionar(ultimo.atleta!)}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0"
                      >
                        Abrir mesmo assim
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400 font-mono">
                    Código lido: {ultimo.codigo} — não corresponde a nenhum atleta desta tabela.
                  </p>
                )}
              </div>

              {/* Leituras anteriores */}
              {historico.length > 1 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/70 max-h-48 overflow-y-auto">
                  {historico.slice(1).map((item) => (
                    <div
                      key={`${item.codigo}-${item.quando}`}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-slate-300">
                        {item.atleta ? `#${item.atleta.bib_number} ${item.atleta.name}` : item.codigo}
                      </span>
                      <span
                        className={`shrink-0 font-semibold ${
                          item.veredito === "pendente"
                            ? "text-emerald-400"
                            : item.veredito === "ja_entregue"
                              ? "text-rose-400"
                              : "text-slate-500"
                        }`}
                      >
                        {item.veredito === "pendente"
                          ? "pendente"
                          : item.veredito === "ja_entregue"
                            ? "já entregue"
                            : "não encontrada"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

import { useCallback, useEffect, useRef } from "react";
import { client, DATABASE_ID, COLLECTIONS } from "../lib/appwrite";

/**
 * Sincronização viva com o Appwrite (realtime + polling de segurança).
 *
 * Por que este hook existe:
 * a assinatura realtime dispara um evento POR DOCUMENTO. Ao importar uma
 * planilha de 2 mil atletas com 25 gravações concorrentes, a versão anterior
 * disparava um recarregamento completo (estatísticas + lista de eventos, que
 * por si só faz 2 consultas por evento) a cada documento criado. Resultado:
 * dezenas de milhares de requisições disputando as 6 conexões do navegador,
 * a aba travava e a tela ficava girando para sempre.
 *
 * A correção tem três partes:
 *   1. os eventos de realtime são unificados numa única atualização atrasada;
 *   2. nunca há duas atualizações em voo — a seguinte é enfileirada;
 *   3. operações em lote suspendem a sincronização e disparam UMA atualização no fim.
 */

interface UseLiveSyncOptions {
  enabled: boolean;
  /** Função de recarga. Pode trocar a cada render — o hook sempre usa a última. */
  refresh: () => Promise<void> | void;
  /** Intervalo do polling de segurança, para o caso do websocket cair. */
  pollMs?: number;
  /** Janela de agrupamento dos eventos de realtime. */
  debounceMs?: number;
}

// Contador global de operações em lote em andamento (importação, limpeza, reset).
let operacoesEmLote = 0;
const ouvintesDeLote = new Set<() => void>();

export function beginBulkOperation() {
  operacoesEmLote += 1;
}

export function endBulkOperation() {
  operacoesEmLote = Math.max(0, operacoesEmLote - 1);
  if (operacoesEmLote === 0) ouvintesDeLote.forEach((fn) => fn());
}

export const isBulkOperationRunning = () => operacoesEmLote > 0;

/** Executa um trabalho pesado com a sincronização suspensa do início ao fim. */
export async function runBulkOperation<T>(trabalho: () => Promise<T>): Promise<T> {
  beginBulkOperation();
  try {
    return await trabalho();
  } finally {
    endBulkOperation();
  }
}

export function useLiveSync({ enabled, refresh, pollMs = 8000, debounceMs = 1200 }: UseLiveSyncOptions) {
  const refreshRef = useRef(refresh);
  const emVoo = useRef(false);
  const pendente = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  refreshRef.current = refresh;

  const executar = useCallback(async () => {
    if (isBulkOperationRunning()) return;

    // Já existe uma recarga rodando: marca que outra ficou devendo e sai.
    if (emVoo.current) {
      pendente.current = true;
      return;
    }

    emVoo.current = true;
    try {
      await refreshRef.current();
    } catch (err) {
      console.warn("Falha na sincronização automática:", err);
    } finally {
      emVoo.current = false;

      if (pendente.current) {
        pendente.current = false;
        void executar();
      }
    }
  }, []);

  const agendar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void executar();
    }, debounceMs);
  }, [executar, debounceMs]);

  useEffect(() => {
    if (!enabled) return;

    void executar();

    const intervalo = setInterval(() => void executar(), pollMs);

    // Ao terminar uma operação em lote, uma única atualização coloca tudo em dia.
    const aoFinalizarLote = () => agendar();
    ouvintesDeLote.add(aoFinalizarLote);

    let cancelarInscricao: (() => void) | undefined;
    try {
      cancelarInscricao = client.subscribe(
        [
          `databases.${DATABASE_ID}.collections.${COLLECTIONS.PARTICIPANTS}.documents`,
          `databases.${DATABASE_ID}.collections.${COLLECTIONS.EVENTS}.documents`
        ],
        () => agendar()
      );
    } catch (err) {
      console.warn("Realtime indisponível, seguindo apenas com polling:", err);
    }

    return () => {
      clearInterval(intervalo);
      ouvintesDeLote.delete(aoFinalizarLote);
      if (timer.current) clearTimeout(timer.current);
      cancelarInscricao?.();
    };
  }, [enabled, executar, agendar, pollMs]);

  return { refreshNow: executar };
}

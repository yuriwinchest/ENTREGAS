import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Captura leituras de uma leitora RFID em modo "teclado" (USB HID).
 *
 * POR QUE ASSIM: a leitora CPH-F206 se apresenta ao computador como um teclado
 * e "digita" o código da tag seguido de Enter. Isso dispensa driver, SDK e
 * qualquer programa intermediário — o navegador simplesmente recebe as teclas.
 *
 * O truque para separar a leitora de uma pessoa digitando é a CADÊNCIA: a
 * leitora despeja os caracteres em poucos milissegundos, um humano leva
 * dezenas. Só a rajada rápida terminada em Enter é tratada como leitura.
 *
 * A escuta é global (na janela), então funciona mesmo sem nenhum campo focado
 * — o operador não precisa clicar em lugar nenhum antes de passar a tag.
 */

interface UseTagReaderOptions {
  /** Liga e desliga a escuta. */
  ativo: boolean;
  /** Chamado quando uma leitura completa e válida é reconhecida. */
  onLeitura: (codigo: string) => void;
  /** Intervalo máximo entre teclas para ainda ser considerado leitora (ms). */
  intervaloMaximoMs?: number;
  /** Tamanho mínimo do código para evitar disparo por tecla solta. */
  tamanhoMinimo?: number;
  /** Janela em que a MESMA tag é ignorada, pois a leitora repete sem parar (ms). */
  janelaDeRepeticaoMs?: number;
}

export interface EstadoDaLeitora {
  /** Última leitura reconhecida, para exibir na tela. */
  ultimoCodigo: string | null;
  /** Quantas leituras foram reconhecidas nesta sessão. */
  totalDeLeituras: number;
  /** Verdadeiro no instante em que uma tag entra, para piscar a interface. */
  recebendo: boolean;
}

export function useTagReader({
  ativo,
  onLeitura,
  intervaloMaximoMs = 60,
  tamanhoMinimo = 4,
  janelaDeRepeticaoMs = 3000
}: UseTagReaderOptions): EstadoDaLeitora {
  const buffer = useRef("");
  const ultimaTecla = useRef(0);
  const lidasRecentemente = useRef(new Map<string, number>());
  const callbackRef = useRef(onLeitura);

  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);
  const [totalDeLeituras, setTotalDeLeituras] = useState(0);
  const [recebendo, setRecebendo] = useState(false);

  callbackRef.current = onLeitura;

  const aceitar = useCallback(
    (codigo: string) => {
      const agora = Date.now();

      // A leitora repete a mesma tag enquanto ela estiver no campo da antena.
      // Sem esta janela, um atleta parado na frente dispararia dezenas de vezes.
      const ultimaVez = lidasRecentemente.current.get(codigo);
      if (ultimaVez && agora - ultimaVez < janelaDeRepeticaoMs) return;

      lidasRecentemente.current.set(codigo, agora);

      // Limpeza preguiçosa para o mapa não crescer durante um evento inteiro.
      if (lidasRecentemente.current.size > 500) {
        for (const [tag, quando] of lidasRecentemente.current) {
          if (agora - quando > janelaDeRepeticaoMs) lidasRecentemente.current.delete(tag);
        }
      }

      setUltimoCodigo(codigo);
      setTotalDeLeituras((n) => n + 1);
      setRecebendo(true);
      setTimeout(() => setRecebendo(false), 400);

      callbackRef.current(codigo);
    },
    [janelaDeRepeticaoMs]
  );

  useEffect(() => {
    if (!ativo) {
      buffer.current = "";
      return;
    }

    const aoDigitar = (evento: KeyboardEvent) => {
      // Atalhos do sistema não são leitura de tag.
      if (evento.ctrlKey || evento.altKey || evento.metaKey) return;

      const agora = Date.now();
      const intervalo = agora - ultimaTecla.current;
      ultimaTecla.current = agora;

      // Pausa longa significa digitação humana: recomeça o acúmulo.
      if (intervalo > intervaloMaximoMs) buffer.current = "";

      if (evento.key === "Enter") {
        const codigo = buffer.current.trim();
        buffer.current = "";

        if (codigo.length >= tamanhoMinimo) {
          // Impede que o Enter da leitora acione o botão em foco.
          evento.preventDefault();
          aceitar(codigo.toUpperCase());
        }
        return;
      }

      // Só caracteres imprimíveis compõem o código.
      if (evento.key.length === 1) buffer.current += evento.key;
    };

    window.addEventListener("keydown", aoDigitar, true);
    return () => window.removeEventListener("keydown", aoDigitar, true);
  }, [ativo, intervaloMaximoMs, tamanhoMinimo, aceitar]);

  return { ultimoCodigo, totalDeLeituras, recebendo };
}

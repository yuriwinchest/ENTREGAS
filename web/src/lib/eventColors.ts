/**
 * Identidade visual de cada evento.
 *
 * Antes todas as abas eram da mesma cor e só o texto diferenciava uma da
 * outra — no meio da operação, com a fila andando, ninguém consegue ler nome
 * por nome para saber em qual tabela está trabalhando.
 *
 * Cada evento passa a ter uma cor fixa, derivada do próprio id. A mesma prova
 * é sempre da mesma cor, em qualquer tela e em qualquer máquina, sem precisar
 * guardar nada no banco.
 *
 * As classes são escritas por extenso de propósito: o Tailwind remove o que
 * não encontra no código-fonte, então nome de classe montado em tempo de
 * execução simplesmente não existiria no CSS final.
 */

export interface PaletaDoEvento {
  nome: string;
  /** Bolinha/marcador de identidade, sempre visível. */
  ponto: string;
  /** Aba selecionada. */
  ativoFundo: string;
  ativoBorda: string;
  ativoTexto: string;
  /** Aba não selecionada. */
  inativoFundo: string;
  inativoBorda: string;
  /** Barra de progresso de entrega. */
  barra: string;
  /** Faixa lateral que amarra a aba ao conteúdo. */
  faixa: string;
}

const PALETAS: PaletaDoEvento[] = [
  {
    nome: "ciano",
    ponto: "bg-cyan-400",
    ativoFundo: "bg-cyan-500/20",
    ativoBorda: "border-cyan-400 ring-cyan-400/30",
    ativoTexto: "text-cyan-200",
    inativoFundo: "bg-cyan-500/[0.06] hover:bg-cyan-500/[0.12]",
    inativoBorda: "border-cyan-500/25 hover:border-cyan-500/50",
    barra: "bg-cyan-400",
    faixa: "bg-cyan-400"
  },
  {
    nome: "violeta",
    ponto: "bg-violet-400",
    ativoFundo: "bg-violet-500/20",
    ativoBorda: "border-violet-400 ring-violet-400/30",
    ativoTexto: "text-violet-200",
    inativoFundo: "bg-violet-500/[0.06] hover:bg-violet-500/[0.12]",
    inativoBorda: "border-violet-500/25 hover:border-violet-500/50",
    barra: "bg-violet-400",
    faixa: "bg-violet-400"
  },
  {
    nome: "âmbar",
    ponto: "bg-amber-400",
    ativoFundo: "bg-amber-500/20",
    ativoBorda: "border-amber-400 ring-amber-400/30",
    ativoTexto: "text-amber-200",
    inativoFundo: "bg-amber-500/[0.06] hover:bg-amber-500/[0.12]",
    inativoBorda: "border-amber-500/25 hover:border-amber-500/50",
    barra: "bg-amber-400",
    faixa: "bg-amber-400"
  },
  {
    nome: "esmeralda",
    ponto: "bg-emerald-400",
    ativoFundo: "bg-emerald-500/20",
    ativoBorda: "border-emerald-400 ring-emerald-400/30",
    ativoTexto: "text-emerald-200",
    inativoFundo: "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]",
    inativoBorda: "border-emerald-500/25 hover:border-emerald-500/50",
    barra: "bg-emerald-400",
    faixa: "bg-emerald-400"
  },
  {
    nome: "rosa",
    ponto: "bg-rose-400",
    ativoFundo: "bg-rose-500/20",
    ativoBorda: "border-rose-400 ring-rose-400/30",
    ativoTexto: "text-rose-200",
    inativoFundo: "bg-rose-500/[0.06] hover:bg-rose-500/[0.12]",
    inativoBorda: "border-rose-500/25 hover:border-rose-500/50",
    barra: "bg-rose-400",
    faixa: "bg-rose-400"
  },
  {
    nome: "laranja",
    ponto: "bg-orange-400",
    ativoFundo: "bg-orange-500/20",
    ativoBorda: "border-orange-400 ring-orange-400/30",
    ativoTexto: "text-orange-200",
    inativoFundo: "bg-orange-500/[0.06] hover:bg-orange-500/[0.12]",
    inativoBorda: "border-orange-500/25 hover:border-orange-500/50",
    barra: "bg-orange-400",
    faixa: "bg-orange-400"
  },
  {
    nome: "azul",
    ponto: "bg-sky-400",
    ativoFundo: "bg-sky-500/20",
    ativoBorda: "border-sky-400 ring-sky-400/30",
    ativoTexto: "text-sky-200",
    inativoFundo: "bg-sky-500/[0.06] hover:bg-sky-500/[0.12]",
    inativoBorda: "border-sky-500/25 hover:border-sky-500/50",
    barra: "bg-sky-400",
    faixa: "bg-sky-400"
  },
  {
    nome: "lima",
    ponto: "bg-lime-400",
    ativoFundo: "bg-lime-500/20",
    ativoBorda: "border-lime-400 ring-lime-400/30",
    ativoTexto: "text-lime-200",
    inativoFundo: "bg-lime-500/[0.06] hover:bg-lime-500/[0.12]",
    inativoBorda: "border-lime-500/25 hover:border-lime-500/50",
    barra: "bg-lime-400",
    faixa: "bg-lime-400"
  }
];

/** Cor da visão "todas as tabelas", propositalmente neutra. */
export const PALETA_GERAL: PaletaDoEvento = {
  nome: "neutro",
  ponto: "bg-slate-300",
  ativoFundo: "bg-slate-100/10",
  ativoBorda: "border-slate-300 ring-slate-300/20",
  ativoTexto: "text-white",
  inativoFundo: "bg-slate-500/[0.06] hover:bg-slate-500/[0.12]",
  inativoBorda: "border-slate-600/40 hover:border-slate-500",
  barra: "bg-slate-300",
  faixa: "bg-slate-300"
};

/** Hash estável: a mesma prova recebe sempre a mesma cor. */
function embaralhar(texto: string): number {
  let valor = 0;
  for (let i = 0; i < texto.length; i++) {
    valor = (valor * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return valor;
}

export const paletaDoEvento = (eventId: string): PaletaDoEvento =>
  PALETAS[embaralhar(eventId) % PALETAS.length];

/**
 * Distribui as cores entre os eventos visíveis SEM repetir.
 *
 * O hash sozinho colide: com poucas provas na tela, duas acabavam da mesma cor
 * e a distinção visual — que é o ponto — se perdia. Aqui cada evento parte da
 * cor do próprio hash e, se ela já estiver tomada, anda para a próxima livre.
 * Enquanto o conjunto de provas não muda, as cores permanecem as mesmas.
 */
export function paletasParaEventos(eventIds: string[]): Record<string, PaletaDoEvento> {
  const ocupadas = new Set<number>();
  const mapa: Record<string, PaletaDoEvento> = {};

  for (const id of eventIds) {
    let indice = embaralhar(id) % PALETAS.length;

    for (let tentativa = 0; tentativa < PALETAS.length && ocupadas.has(indice); tentativa++) {
      indice = (indice + 1) % PALETAS.length;
    }

    ocupadas.add(indice);
    mapa[id] = PALETAS[indice];
  }

  return mapa;
}

/**
 * Sigla do marcador da aba.
 *
 * Precisa separar provas de nome parecido: "CORRIDA TESTE 1" e "CORRIDA TESTE
 * 3" davam "CT" as duas. Números entram na sigla justamente por serem o que
 * distingue as edições de uma mesma prova.
 */
export function iniciaisDoEvento(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length >= 2 || /\d/.test(p));

  if (partes.length === 0) return nome.slice(0, 2).toUpperCase() || "??";
  if (partes.length === 1) return partes[0].slice(0, 3).toUpperCase();

  const sigla = partes
    .slice(0, 3)
    .map((p) => (/^\d+$/.test(p) ? p.slice(0, 2) : p[0]))
    .join("");

  return sigla.toUpperCase().slice(0, 3);
}

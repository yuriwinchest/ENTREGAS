import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, DATABASE_ID } from "./client";
import { auth } from "./auth";

/**
 * Criação de documentos em lote.
 *
 * ⚠️ REGRA INEGOCIÁVEL DESTE ARQUIVO ⚠️
 * Aqui só existe CRIAÇÃO. Exclusão e atualização em lote estão proibidas no
 * navegador e vivem exclusivamente na Function `admin-api`.
 *
 * O motivo é concreto: nas escritas em lote o Appwrite lê o filtro apenas do
 * CORPO da requisição. Se o filtro for enviado na query string ele é
 * silenciosamente ignorado e a operação atinge a COLLECTION INTEIRA. Numa
 * criação isso é inofensivo (nasce documento a mais); numa exclusão apaga
 * tudo. Por isso o caminho destrutivo não passa por aqui.
 *
 * O SDK web 17 não expõe operações em lote, então a chamada é REST direta,
 * autenticada com um JWT de curta duração emitido pela sessão atual.
 */

/** Teto do Appwrite: 100 documentos por requisição. */
const TAMANHO_DO_LOTE = 100;

/** Lotes disparados ao mesmo tempo. Acima disso o servidor vira o gargalo. */
const LOTES_SIMULTANEOS = 4;

export interface DocumentoParaCriar {
  $id: string;
  $permissions: string[];
  [campo: string]: unknown;
}

export interface ResultadoDoLote {
  inserted: number;
  errors: number;
  requisicoes: number;
}

function fatiar<T>(itens: T[], tamanho: number): T[][] {
  const fatias: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) fatias.push(itens.slice(i, i + tamanho));
  return fatias;
}

/**
 * Grava os documentos em lotes de 100, com alguns lotes em paralelo.
 * Devolve quantos entraram, quantos falharam e quantas requisições custou.
 */
export async function createDocumentsInBatches(
  collectionId: string,
  documentos: DocumentoParaCriar[],
  onProgress?: (concluidos: number, total: number) => void
): Promise<ResultadoDoLote> {
  if (documentos.length === 0) return { inserted: 0, errors: 0, requisicoes: 0 };

  const jwt = await auth.createJWT();
  const url = `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${collectionId}/documents`;
  const cabecalhos = {
    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    "X-Appwrite-JWT": jwt,
    "Content-Type": "application/json"
  };

  const lotes = fatiar(documentos, TAMANHO_DO_LOTE);

  let inserted = 0;
  let errors = 0;
  let requisicoes = 0;
  let concluidos = 0;
  let proximoLote = 0;

  const gravarLote = async (lote: DocumentoParaCriar[]) => {
    requisicoes++;

    const resposta = await fetch(url, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ documents: lote })
    });

    if (resposta.ok) {
      inserted += lote.length;
      return;
    }

    // Um lote inteiro perdido por causa de uma linha ruim é inaceitável na
    // operação: cai para gravação individual só neste lote e salva o resto.
    const erro = await resposta.json().catch(() => ({}));
    console.warn(`Lote recusado (${resposta.status}): ${erro?.message || "sem detalhe"}. Regravando um a um.`);

    for (const documento of lote) {
      const { $id, $permissions, ...dados } = documento;
      requisicoes++;

      const individual = await fetch(url, {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify({ documentId: $id, data: dados, permissions: $permissions })
      });

      if (individual.ok) inserted++;
      else {
        errors++;
        const detalhe = await individual.json().catch(() => ({}));
        console.warn(`Atleta não importado (${dados.bib_number ?? "?"}):`, detalhe?.message);
      }
    }
  };

  const trabalhadores = Array.from({ length: Math.min(LOTES_SIMULTANEOS, lotes.length) }, async () => {
    while (proximoLote < lotes.length) {
      const lote = lotes[proximoLote++];
      try {
        await gravarLote(lote);
      } catch (err) {
        errors += lote.length;
        console.error("Falha de rede ao gravar lote:", err);
      } finally {
        concluidos += lote.length;
        onProgress?.(Math.min(concluidos, documentos.length), documentos.length);
      }
    }
  });

  await Promise.all(trabalhadores);

  return { inserted, errors, requisicoes };
}

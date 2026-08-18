import { Query, ID } from "appwrite";
import { databases, DATABASE_ID, COLLECTIONS, normalizeFolded, runConcurrentPool } from "./client";
import { requireTenant, tenantScope, eventScope, tenantDocumentPermissions } from "./tenancy";
import { createDocumentsInBatches } from "./bulk";
import { adminApi } from "../adminApi";
import { Participant, DeliveryStats } from "../../types";

const CONCORRENCIA = 25;

const texto = (valor?: string | number | null, max = 250): string | null => {
  if (valor == null || valor === "") return null;
  const s = String(valor).trim();
  return s.length > max ? s.slice(0, max) : s;
};

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Converte Date, serial do Excel ou ISO para o formato brasileiro DD/MM/AAAA. */
const formatarData = (valor?: any): string | null => {
  if (valor == null || valor === "") return null;

  // Com `cellDates: true` a planilha entrega objetos Date — sem este ramo o
  // valor virava a string crua do JS ("Sun Aug 09 1987 00:00:28 GMT-0300").
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${doisDigitos(valor.getDate())}/${doisDigitos(valor.getMonth() + 1)}/${valor.getFullYear()}`;
  }

  if (typeof valor === "number" && valor > 10000 && valor < 60000) {
    const date = new Date((valor - 25569) * 86400 * 1000);
    const d = String(date.getUTCDate()).padStart(2, "0");
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${date.getUTCFullYear()}`;
  }

  const s = String(valor).trim();
  if (s.includes("T")) {
    const partes = s.split("T")[0].split("-");
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  return texto(s, 30);
};

async function buscarPorCampo(
  campo: "chip" | "bib_number" | "qr_code",
  valor: string,
  eventId?: string | null
): Promise<Participant | null> {
  const limpo = campo === "chip" ? valor.trim().toUpperCase() : valor.trim();
  if (!limpo) return null;

  try {
    const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
      ...tenantScope(),
      ...eventScope(eventId),
      Query.equal(campo, limpo),
      Query.limit(1)
    ]);

    if (res.documents.length > 0) return res.documents[0];

    // Fallback dentro do tenant: o atleta pode estar em outra tabela do ambiente.
    if (eventId && eventId !== "all") {
      const global = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        ...tenantScope(),
        ...eventScope(null),
        Query.equal(campo, limpo),
        Query.limit(1)
      ]);
      if (global.documents.length > 0) return global.documents[0];
    }

    return null;
  } catch (err) {
    console.error(`Erro ao buscar atleta por ${campo}:`, err);
    return null;
  }
}

export const participantsApi = {
  findParticipantByChip: (chip: string, eventId?: string | null) =>
    buscarPorCampo("chip", chip, eventId),

  findParticipantByNumber: (numero: string, eventId?: string | null) =>
    buscarPorCampo("bib_number", numero, eventId),

  findParticipantByQr: (qr: string, eventId?: string | null) =>
    buscarPorCampo("qr_code", qr, eventId),

  /**
   * Busca do balcão.
   *
   * Só há um índice fulltext por collection nesta instância, e ele está em
   * `name`. Número, chip, CPF e QR usam igualdade exata — que é o que o
   * scanner precisa. Antes isto usava `Query.contains`, que sem índice
   * fulltext devolvia zero para qualquer nome: o operador digitava e nunca
   * aparecia ninguém.
   */
  async searchParticipants(termo: string, eventId?: string | null, limit = 10): Promise<Participant[]> {
    const limpo = termo.trim();
    if (!limpo) return [];

    const escopo = [...tenantScope(), ...eventScope(eventId), Query.limit(limit)];
    const somenteDigitos = limpo.replace(/\D/g, "");

    // Tentativas em ordem de precisão: o primeiro acerto encerra a busca.
    const tentativas: string[][] = [];

    if (/^\d+$/.test(limpo)) {
      tentativas.push([Query.equal("bib_number", limpo)]);
      tentativas.push([Query.equal("chip", limpo.toUpperCase())]);
    } else {
      tentativas.push([Query.search("name", limpo.toUpperCase())]);
      tentativas.push([Query.equal("chip", limpo.toUpperCase())]);
      tentativas.push([Query.equal("qr_code", limpo)]);
    }

    if (somenteDigitos.length === 11) tentativas.push([Query.equal("cpf", limpo)]);

    for (const tentativa of tentativas) {
      try {
        const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
          ...escopo,
          ...tentativa
        ]);
        if (res.documents.length > 0) return res.documents;
      } catch (err) {
        console.warn("Consulta de busca recusada, tentando a próxima:", err);
      }
    }

    return [];
  },

  async listParticipants(options?: {
    limit?: number;
    offset?: number;
    deliveredOnly?: boolean;
    pendingOnly?: boolean;
    search?: string;
    eventId?: string | null;
  }): Promise<{ documents: Participant[]; total: number }> {
    const queries: string[] = [
      ...tenantScope(),
      ...eventScope(options?.eventId),
      Query.limit(options?.limit || 50),
      Query.offset(options?.offset || 0),
      Query.orderDesc("$updatedAt")
    ];

    if (options?.deliveredOnly) queries.push(Query.isNotNull("delivered_at"));
    else if (options?.pendingOnly) queries.push(Query.isNull("delivered_at"));

    if (options?.search) {
      const termo = options.search.trim();
      // `search` usa o índice fulltext; para número de peito, igualdade exata.
      queries.push(
        /^\d+$/.test(termo)
          ? Query.equal("bib_number", termo)
          : Query.search("name", termo.toUpperCase())
      );
    }

    try {
      const res = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        queries
      );
      return { documents: res.documents, total: res.total };
    } catch (err) {
      console.error("Erro ao listar atletas:", err);
      return { documents: [], total: 0 };
    }
  },

  async getStats(eventId?: string | null): Promise<DeliveryStats> {
    try {
      const base = [...tenantScope(), ...eventScope(eventId)];

      const [totalRes, entreguesRes] = await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [...base, Query.limit(1)]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
          ...base,
          Query.isNotNull("delivered_at"),
          Query.limit(1)
        ])
      ]);

      const total = totalRes.total;
      const delivered = entreguesRes.total;

      return {
        total,
        delivered,
        pending: Math.max(0, total - delivered),
        percentage: total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 0,
        deliveriesLastHour: delivered,
        eventId: eventId || null
      };
    } catch (err) {
      console.error("Erro ao buscar estatísticas:", err);
      return { total: 0, delivered: 0, pending: 0, percentage: 0, deliveriesLastHour: 0, eventId: null };
    }
  },

  async updateParticipant(id: string, data: Partial<Participant>): Promise<Participant> {
    const payload: Record<string, any> = {};

    if (data.bib_number !== undefined) payload.bib_number = texto(data.bib_number, 30);
    if (data.chip !== undefined) payload.chip = texto(String(data.chip).toUpperCase(), 60);
    if (data.name !== undefined) {
      payload.name = texto(String(data.name).toUpperCase(), 250);
      payload.name_folded = normalizeFolded(payload.name || "");
    }
    if (data.cpf !== undefined) payload.cpf = texto(data.cpf, 30);
    if (data.birth_date !== undefined) payload.birth_date = texto(data.birth_date, 30);
    if (data.sex !== undefined) payload.sex = texto(data.sex?.toUpperCase(), 15);
    if (data.shirt !== undefined) payload.shirt = texto(data.shirt?.toUpperCase(), 30);
    if (data.modality !== undefined) payload.modality = texto(data.modality, 120);
    if (data.category !== undefined) payload.category = texto(data.category, 120);
    if (data.qr_code !== undefined) payload.qr_code = texto(data.qr_code, 480);
    if (data.event_id !== undefined) payload.event_id = data.event_id;
    if (data.event_name !== undefined) payload.event_name = data.event_name;
    if (data.delivered_at !== undefined) payload.delivered_at = data.delivered_at;
    if (data.receiver_name !== undefined) payload.receiver_name = data.receiver_name;

    return databases.updateDocument<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id, payload);
  },

  async deleteParticipant(id: string): Promise<boolean> {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id);
      return true;
    } catch (err) {
      console.error("Erro ao excluir atleta:", err);
      return false;
    }
  },

  /**
   * Exclusão em massa dos atletas.
   *
   * Executada pela Function `admin-api`, NUNCA aqui no navegador.
   *
   * Motivo: a exclusão em lote do Appwrite só respeita o filtro quando ele vai
   * no corpo da requisição. Enviado na query string, o filtro é ignorado em
   * silêncio e a COLLECTION INTEIRA é apagada. Concentrar essa chamada num
   * único ponto no servidor — onde o filtro de tenant é obrigatório e a
   * contagem é conferida antes e depois — é o que impede um acidente desses.
   */
  async deleteAllParticipants(
    eventId?: string | null,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ deleted: number; errors: number }> {
    try {
      const alvo = eventId && eventId !== "all" ? eventId : null;

      onProgress?.(0, 1);
      const res = await adminApi.purgeParticipants(alvo);
      onProgress?.(res.deleted, res.deleted || 1);

      return { deleted: res.deleted, errors: 0 };
    } catch (err) {
      console.error("Erro na exclusão em massa:", err);
      return { deleted: 0, errors: 1 };
    }
  },

  /** Reset de entregas em massa. Mesmo caminho servidor da exclusão. */
  async resetAllDeliveries(
    eventId?: string | null,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ reset: number; errors: number }> {
    try {
      const alvo = eventId && eventId !== "all" ? eventId : null;

      onProgress?.(0, 1);
      const res = await adminApi.resetDeliveries(alvo);
      onProgress?.(res.reset, res.reset || 1);

      return { reset: res.reset, errors: 0 };
    } catch (err) {
      console.error("Erro ao resetar entregas:", err);
      return { reset: 0, errors: 1 };
    }
  },

  /** Importação em lote de uma planilha já mapeada, sempre vinculada a um evento. */
  async batchImportParticipants(
    lista: Array<{
      bib_number: string;
      chip: string;
      name: string;
      cpf?: string;
      birth_date?: string;
      sex?: string;
      shirt?: string;
      modality?: string;
      category?: string;
      qr_code?: string;
    }>,
    eventId: string,
    eventName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ inserted: number; errors: number }> {
    const tenant = requireTenant();
    const permissoes = tenantDocumentPermissions();

    const documentos = lista.map((p) => {
      const bib = texto(p.bib_number, 30) || "0";
      const chip = (texto(p.chip, 60) || bib).toUpperCase();
      const nome = (texto(p.name, 250) || "ATLETA").toUpperCase();

      return {
        $id: ID.unique(),
        $permissions: permissoes,
        bib_number: bib,
        chip,
        name: nome,
        name_folded: normalizeFolded(nome),
        cpf: texto(p.cpf, 30),
        birth_date: formatarData(p.birth_date),
        sex: texto(p.sex?.toUpperCase(), 15),
        shirt: texto(p.shirt?.toUpperCase(), 30),
        modality: texto(p.modality, 120),
        category: texto(p.category, 120),
        qr_code: texto(p.qr_code, 480) || bib,
        event_id: eventId,
        event_name: eventName,
        tenant_id: tenant.tenantId,
        owner_id: tenant.userId,
        delivered_at: null,
        receiver_name: null
      };
    });

    // Gravação em lotes de 100. Uma planilha de 2 mil atletas sai em 20
    // requisições no lugar de 2 mil — era esse round-trip por linha que fazia
    // a importação demorar minutos.
    const { inserted, errors, requisicoes } = await createDocumentsInBatches(
      COLLECTIONS.PARTICIPANTS,
      documentos,
      onProgress
    );

    console.info(`Importação: ${inserted} atletas em ${requisicoes} requisição(ões).`);

    return { inserted, errors };
  }
};

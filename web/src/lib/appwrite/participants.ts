import { Query, ID } from "appwrite";
import { databases, DATABASE_ID, COLLECTIONS, normalizeFolded, runConcurrentPool } from "./client";
import { requireTenant, tenantScope, eventScope, tenantDocumentPermissions } from "./tenancy";
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

  async searchParticipants(termo: string, eventId?: string | null, limit = 10): Promise<Participant[]> {
    const limpo = termo.trim();
    if (!limpo) return [];

    try {
      const queries = [...tenantScope(), ...eventScope(eventId), Query.limit(limit)];

      if (/^\d+$/.test(limpo)) queries.push(Query.equal("bib_number", limpo));
      else queries.push(Query.contains("name", limpo.toUpperCase()));

      const res = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        queries
      );
      return res.documents;
    } catch (err) {
      console.error("Erro na busca de atletas:", err);
      return [];
    }
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

    if (options?.search) queries.push(Query.contains("name", options.search.trim().toUpperCase()));

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

  /** Exclusão em massa dentro do escopo do tenant, em lotes concorrentes. */
  async deleteAllParticipants(
    eventId?: string | null,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    try {
      const base = [...tenantScope(), ...eventScope(eventId)];

      const inicial = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        ...base,
        Query.limit(1)
      ]);

      const totalInicial = inicial.total;
      if (totalInicial === 0) return { deleted: 0, errors: 0 };

      for (;;) {
        const lote = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
          ...base,
          Query.select(["$id"]),
          Query.limit(100)
        ]);

        if (lote.documents.length === 0) break;

        await runConcurrentPool(
          lote.documents.map((d) => d.$id),
          CONCORRENCIA,
          async (id) => {
            try {
              await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id);
              deleted++;
            } catch (e) {
              console.warn("Erro ao excluir documento:", id, e);
              errors++;
            }
            onProgress?.(deleted + errors, totalInicial);
          }
        );

        if (lote.documents.length < 100) break;
      }
    } catch (err) {
      console.error("Erro na limpeza em massa:", err);
    }

    return { deleted, errors };
  },

  async resetAllDeliveries(
    eventId?: string | null,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ reset: number; errors: number }> {
    let reset = 0;
    let errors = 0;

    try {
      const entregues = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        [
          ...tenantScope(),
          ...eventScope(eventId),
          Query.isNotNull("delivered_at"),
          Query.select(["$id"]),
          Query.limit(5000)
        ]
      );

      const total = entregues.documents.length;
      if (total === 0) return { reset: 0, errors: 0 };

      await runConcurrentPool(
        entregues.documents.map((d) => d.$id),
        CONCORRENCIA,
        async (id) => {
          try {
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id, {
              delivered_at: null,
              receiver_name: null
            });
            reset++;
          } catch (e) {
            console.warn("Erro ao resetar entrega:", id, e);
            errors++;
          }
          onProgress?.(reset + errors, total);
        }
      );
    } catch (err) {
      console.error("Erro ao resetar entregas:", err);
    }

    return { reset, errors };
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

    let inserted = 0;
    let errors = 0;
    let concluidos = 0;
    const total = lista.length;

    const payloads = lista.map((p) => {
      const bib = texto(p.bib_number, 30) || "0";
      const chip = (texto(p.chip, 60) || bib).toUpperCase();
      const nome = (texto(p.name, 250) || "ATLETA").toUpperCase();

      return {
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

    await runConcurrentPool(payloads, CONCORRENCIA, async (payload) => {
      try {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          ID.unique(),
          payload,
          permissoes
        );
        inserted++;
      } catch (err) {
        console.warn(`Erro ao importar ${payload.name} (#${payload.bib_number}):`, err);
        errors++;
      } finally {
        concluidos++;
        onProgress?.(concluidos, total);
      }
    });

    return { inserted, errors };
  }
};

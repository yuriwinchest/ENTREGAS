import { Client, Databases, Account, Query, ID } from "appwrite";
import { Participant, DeliveryAudit, EventSettings, DeliveryStats, EventItem } from "../types";

// Configurações do Appwrite Cloud
export const APPWRITE_ENDPOINT = "https://db.largadabrasil.com/v1";
export const APPWRITE_PROJECT_ID = "6a8238cc001997d3b0c8";
export const DATABASE_ID = "chipower_entregas";

export const COLLECTIONS = {
  PARTICIPANTS: "participants",
  DELIVERY_AUDIT: "delivery_audit",
  EVENT_SETTINGS: "event_settings",
  EVENTS: "events"
};

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const databases = new Databases(client);
export const account = new Account(client);

// Normalização para busca sem acentos e case-insensitive
export const normalizeFolded = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

// Helper de Concorrência em Pool de Alta Performance (Worker Queue)
async function runConcurrentPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const poolWorkers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        console.warn(`Worker error on item ${index}:`, err);
      }
    }
  });

  await Promise.all(poolWorkers);
  return results;
}

// -------------------------------------------------------------
// SERVIÇOS DE AUTENTICAÇÃO E SESSÃO
// -------------------------------------------------------------
export const auth = {
  async getCurrentUser() {
    try {
      return await account.get();
    } catch {
      return null;
    }
  },

  async login(email: string, pass: string) {
    try {
      try {
        await account.deleteSession("current");
      } catch {}
      return await account.createEmailPasswordSession(email, pass);
    } catch (err: any) {
      console.error("Erro no login Appwrite:", err);
      throw err;
    }
  },

  async logout() {
    try {
      await account.deleteSession("current");
    } catch (err) {
      console.warn("Aviso ao encerrar sessão:", err);
    }
  }
};

// -------------------------------------------------------------
// SERVIÇOS DE BANCO DE DADOS (API SERVICE)
// -------------------------------------------------------------
export const api = {
  // -----------------------------------------------------------
  // GESTÃO DE EVENTOS / TABELAS
  // -----------------------------------------------------------
  async listEvents(): Promise<EventItem[]> {
    try {
      const res = await databases.listDocuments<EventItem>(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        [Query.orderDesc("$createdAt"), Query.limit(100)]
      );

      // Carregar contagens de atletas para cada evento
      const eventsWithStats = await Promise.all(
        res.documents.map(async (ev) => {
          try {
            const totalRes = await databases.listDocuments(
              DATABASE_ID,
              COLLECTIONS.PARTICIPANTS,
              [Query.equal("event_id", ev.$id), Query.limit(1)]
            );
            const deliveredRes = await databases.listDocuments(
              DATABASE_ID,
              COLLECTIONS.PARTICIPANTS,
              [
                Query.equal("event_id", ev.$id),
                Query.isNotNull("delivered_at"),
                Query.limit(1)
              ]
            );
            return {
              ...ev,
              total_athletes: totalRes.total,
              delivered_athletes: deliveredRes.total
            };
          } catch {
            return ev;
          }
        })
      );

      return eventsWithStats;
    } catch (err) {
      console.error("Erro ao listar eventos:", err);
      return [];
    }
  },

  async createEvent(data: {
    name: string;
    event_date?: string;
    location?: string;
    description?: string;
  }): Promise<EventItem> {
    const cleanName = data.name.trim().slice(0, 250);
    return await databases.createDocument<EventItem>(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      ID.unique(),
      {
        name: cleanName,
        event_date: data.event_date ? data.event_date.trim().slice(0, 30) : null,
        location: data.location ? data.location.trim().slice(0, 250) : null,
        description: data.description ? data.description.trim().slice(0, 500) : null,
        is_active: true
      }
    );
  },

  async updateEvent(
    id: string,
    data: Partial<{ name: string; event_date: string; location: string; description: string; is_active: boolean }>
  ): Promise<EventItem> {
    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim().slice(0, 250);
    if (data.event_date !== undefined) updatePayload.event_date = data.event_date?.trim().slice(0, 30) || null;
    if (data.location !== undefined) updatePayload.location = data.location?.trim().slice(0, 250) || null;
    if (data.description !== undefined) updatePayload.description = data.description?.trim().slice(0, 500) || null;
    if (data.is_active !== undefined) updatePayload.is_active = data.is_active;

    const updated = await databases.updateDocument<EventItem>(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      id,
      updatePayload
    );

    // Se mudou o nome do evento, atualiza o event_name nos participantes em lote
    if (data.name) {
      try {
        const parts = await databases.listDocuments<Participant>(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          [Query.equal("event_id", id), Query.limit(5000)]
        );
        runConcurrentPool(parts.documents, 20, async (doc) => {
          await databases.updateDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, doc.$id, {
            event_name: data.name!.trim().slice(0, 250)
          });
        });
      } catch (err) {
        console.warn("Aviso ao sincronizar nome nos participantes:", err);
      }
    }

    return updated;
  },

  async deleteEvent(id: string, onProgress?: (current: number, total: number) => void): Promise<boolean> {
    try {
      // 1. Excluir todos os atletas vinculados a este evento
      await api.deleteAllParticipants(id, onProgress);

      // 2. Excluir o documento do evento
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EVENTS, id);
      return true;
    } catch (err) {
      console.error("Erro ao excluir evento:", err);
      return false;
    }
  },

  // -----------------------------------------------------------
  // BUSCAS DE PARTICIPANTES (COM SUPORTE A FILTRO POR EVENTO)
  // -----------------------------------------------------------
  async findParticipantByChip(chip: string, eventId?: string | null): Promise<Participant | null> {
    const cleanEpc = chip.trim().toUpperCase();
    if (!cleanEpc) return null;
    try {
      const queries = [Query.equal("chip", cleanEpc), Query.limit(1)];
      if (eventId && eventId !== "all") {
        queries.push(Query.equal("event_id", eventId));
      }
      const res = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        queries
      );
      if (res.documents.length > 0) return res.documents[0];

      // Fallback sem filtro estrito de evento se não achou
      if (eventId && eventId !== "all") {
        const globalRes = await databases.listDocuments<Participant>(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          [Query.equal("chip", cleanEpc), Query.limit(1)]
        );
        if (globalRes.documents.length > 0) return globalRes.documents[0];
      }
      return null;
    } catch (err) {
      console.error("Erro ao buscar atleta por chip:", err);
      return null;
    }
  },

  async findParticipantByNumber(numberStr: string, eventId?: string | null): Promise<Participant | null> {
    const clean = numberStr.trim();
    if (!clean) return null;
    try {
      const queries = [Query.equal("bib_number", clean), Query.limit(1)];
      if (eventId && eventId !== "all") {
        queries.push(Query.equal("event_id", eventId));
      }
      const res = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        queries
      );
      if (res.documents.length > 0) return res.documents[0];

      // Fallback
      if (eventId && eventId !== "all") {
        const fallbackRes = await databases.listDocuments<Participant>(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          [Query.equal("bib_number", clean), Query.limit(1)]
        );
        if (fallbackRes.documents.length > 0) return fallbackRes.documents[0];
      }
      return null;
    } catch (err) {
      console.error("Erro ao buscar atleta por número:", err);
      return null;
    }
  },

  async findParticipantByQr(qrText: string, eventId?: string | null): Promise<Participant | null> {
    const clean = qrText.trim();
    if (!clean) return null;
    try {
      const queries = [Query.equal("qr_code", clean), Query.limit(1)];
      if (eventId && eventId !== "all") {
        queries.push(Query.equal("event_id", eventId));
      }
      const res = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        queries
      );
      if (res.documents.length > 0) return res.documents[0];
      return null;
    } catch (err) {
      console.error("Erro ao buscar atleta por QR:", err);
      return null;
    }
  },

  async searchParticipants(query: string, eventId?: string | null, limit = 10): Promise<Participant[]> {
    const clean = query.trim();
    if (!clean) return [];
    try {
      const queries: string[] = [Query.limit(limit)];
      if (eventId && eventId !== "all") {
        queries.push(Query.equal("event_id", eventId));
      }

      if (/^\d+$/.test(clean)) {
        queries.push(Query.equal("bib_number", clean));
      } else {
        queries.push(Query.contains("name", clean.toUpperCase()));
      }

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

  // -----------------------------------------------------------
  // ENTREGA DE KITS E AUDITORIA
  // -----------------------------------------------------------
  async deliverKit(
    participant: Participant,
    operatorName: string,
    receiverName?: string
  ): Promise<{ success: boolean; participant?: Participant }> {
    const now = new Date().toISOString();
    const finalReceiver = receiverName?.trim() || participant.name;

    const updated = await databases.updateDocument<Participant>(
      DATABASE_ID,
      COLLECTIONS.PARTICIPANTS,
      participant.$id,
      {
        delivered_at: now,
        receiver_name: finalReceiver
      }
    );

    try {
      await databases.createDocument<DeliveryAudit>(
        DATABASE_ID,
        COLLECTIONS.DELIVERY_AUDIT,
        ID.unique(),
        {
          participant_id: participant.$id,
          epc: participant.chip,
          operator_name: operatorName || "Operador",
          receiver_name: finalReceiver,
          delivered_at: now
        }
      );
    } catch (auditErr) {
      console.warn("Aviso ao salvar auditoria:", auditErr);
    }

    return { success: true, participant: updated };
  },

  async confirmDelivery(
    participant: Participant,
    operatorName: string,
    receiverName?: string
  ): Promise<{ success: boolean; participant?: Participant }> {
    return api.deliverKit(participant, operatorName, receiverName);
  },

  // -----------------------------------------------------------
  // LISTAGEM DE PARTICIPANTES COM FILTRO DE EVENTO
  // -----------------------------------------------------------
  async listParticipants(options?: {
    limit?: number;
    offset?: number;
    deliveredOnly?: boolean;
    pendingOnly?: boolean;
    search?: string;
    eventId?: string | null;
  }): Promise<{ documents: Participant[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const queries: string[] = [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc("$updatedAt")
    ];

    if (options?.eventId && options.eventId !== "all") {
      queries.push(Query.equal("event_id", options.eventId));
    }

    if (options?.deliveredOnly) {
      queries.push(Query.isNotNull("delivered_at"));
    } else if (options?.pendingOnly) {
      queries.push(Query.isNull("delivered_at"));
    }

    if (options?.search) {
      const term = options.search.trim().toUpperCase();
      queries.push(Query.contains("name", term));
    }

    try {
      const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, queries);
      return { documents: res.documents, total: res.total };
    } catch (err) {
      console.error("Erro ao listar participantes:", err);
      return { documents: [], total: 0 };
    }
  },

  async getRecentDeliveries(limit = 10, eventId?: string | null): Promise<Participant[]> {
    try {
      const queries = [
        Query.isNotNull("delivered_at"),
        Query.orderDesc("delivered_at"),
        Query.limit(limit)
      ];
      if (eventId && eventId !== "all") {
        queries.push(Query.equal("event_id", eventId));
      }
      const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, queries);
      return res.documents;
    } catch (err) {
      console.error("Erro ao buscar entregas recentes:", err);
      return [];
    }
  },

  // -----------------------------------------------------------
  // ESTATÍSTICAS (KPIS) ISOLADAS POR EVENTO OU GLOBAIS
  // -----------------------------------------------------------
  async getStats(eventId?: string | null): Promise<DeliveryStats> {
    try {
      const totalQueries = [Query.limit(1)];
      const deliveredQueries = [Query.isNotNull("delivered_at"), Query.limit(1)];

      if (eventId && eventId !== "all") {
        totalQueries.push(Query.equal("event_id", eventId));
        deliveredQueries.push(Query.equal("event_id", eventId));
      }

      const [totalRes, deliveredRes] = await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, totalQueries),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, deliveredQueries)
      ]);

      const total = totalRes.total;
      const delivered = deliveredRes.total;
      const pending = Math.max(0, total - delivered);
      const percentage = total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 0;

      return {
        total,
        delivered,
        pending,
        percentage,
        deliveriesLastHour: delivered,
        eventId: eventId || null
      };
    } catch (err) {
      console.error("Erro ao buscar estatísticas:", err);
      return { total: 0, delivered: 0, pending: 0, percentage: 0, deliveriesLastHour: 0, eventId: null };
    }
  },

  async updateParticipant(id: string, data: Partial<Participant>): Promise<Participant> {
    const cleanData: Record<string, any> = {};
    if (data.bib_number !== undefined) cleanData.bib_number = String(data.bib_number).trim().slice(0, 30);
    if (data.chip !== undefined) cleanData.chip = String(data.chip).trim().toUpperCase().slice(0, 60);
    if (data.name !== undefined) {
      cleanData.name = String(data.name).trim().toUpperCase().slice(0, 250);
      cleanData.name_folded = normalizeFolded(cleanData.name);
    }
    if (data.cpf !== undefined) cleanData.cpf = data.cpf ? String(data.cpf).trim().slice(0, 30) : null;
    if (data.birth_date !== undefined) cleanData.birth_date = data.birth_date ? String(data.birth_date).trim().slice(0, 30) : null;
    if (data.sex !== undefined) cleanData.sex = data.sex ? String(data.sex).trim().toUpperCase().slice(0, 15) : null;
    if (data.shirt !== undefined) cleanData.shirt = data.shirt ? String(data.shirt).trim().toUpperCase().slice(0, 30) : null;
    if (data.modality !== undefined) cleanData.modality = data.modality ? String(data.modality).trim().slice(0, 120) : null;
    if (data.category !== undefined) cleanData.category = data.category ? String(data.category).trim().slice(0, 120) : null;
    if (data.qr_code !== undefined) cleanData.qr_code = data.qr_code ? String(data.qr_code).trim().slice(0, 480) : null;
    if (data.event_id !== undefined) cleanData.event_id = data.event_id;
    if (data.event_name !== undefined) cleanData.event_name = data.event_name;
    if (data.delivered_at !== undefined) cleanData.delivered_at = data.delivered_at;
    if (data.receiver_name !== undefined) cleanData.receiver_name = data.receiver_name;

    return await databases.updateDocument<Participant>(
      DATABASE_ID,
      COLLECTIONS.PARTICIPANTS,
      id,
      cleanData
    );
  },

  async deleteParticipant(id: string): Promise<boolean> {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id);
      return true;
    } catch (err) {
      console.error("Erro ao excluir participante:", err);
      return false;
    }
  },

  // -----------------------------------------------------------
  // EXCLUSÃO ULTRA-RÁPIDA EM LOTE (COM WORKER POOL DE 25 THREADS)
  // -----------------------------------------------------------
  async deleteAllParticipants(
    eventId?: string | null,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;
    const CONCURRENCY = 25; // Pool de alta vazão

    try {
      const countQueries = [Query.limit(1)];
      if (eventId && eventId !== "all") {
        countQueries.push(Query.equal("event_id", eventId));
      }

      const initialRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, countQueries);
      const initialTotal = initialRes.total;
      if (initialTotal === 0) return { deleted: 0, errors: 0 };

      let hasMore = true;
      while (hasMore) {
        const fetchQueries = [Query.limit(100), Query.select(["$id"])];
        if (eventId && eventId !== "all") {
          fetchQueries.push(Query.equal("event_id", eventId));
        }

        const batch = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, fetchQueries);

        if (batch.documents.length === 0) {
          hasMore = false;
          break;
        }

        const docIds = batch.documents.map((d) => d.$id);

        await runConcurrentPool(docIds, CONCURRENCY, async (id) => {
          try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id);
            deleted++;
          } catch (e) {
            console.warn("Erro ao deletar documento:", id, e);
            errors++;
          }
          if (onProgress) {
            onProgress(deleted + errors, initialTotal);
          }
        });

        if (batch.documents.length < 100) {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error("Erro no processo de limpeza ultra-rápida:", err);
    }

    return { deleted, errors };
  },

  // -----------------------------------------------------------
  // RESET DE ENTREGAS ULTRA-RÁPIDO
  // -----------------------------------------------------------
  async resetAllDeliveries(
    eventId?: string | null,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ reset: number; errors: number }> {
    let reset = 0;
    let errors = 0;
    const CONCURRENCY = 25;

    try {
      const queries = [
        Query.isNotNull("delivered_at"),
        Query.select(["$id"]),
        Query.limit(5000)
      ];
      if (eventId && eventId !== "all") {
        queries.push(Query.equal("event_id", eventId));
      }

      const deliveredDocs = await databases.listDocuments<Participant>(
        DATABASE_ID,
        COLLECTIONS.PARTICIPANTS,
        queries
      );

      const total = deliveredDocs.documents.length;
      if (total === 0) return { reset: 0, errors: 0 };

      const docIds = deliveredDocs.documents.map((d) => d.$id);

      await runConcurrentPool(docIds, CONCURRENCY, async (id) => {
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
        if (onProgress) {
          onProgress(reset + errors, total);
        }
      });
    } catch (err) {
      console.error("Erro ao resetar entregas:", err);
    }

    return { reset, errors };
  },

  // -----------------------------------------------------------
  // CONFIGURAÇÕES GERAIS
  // -----------------------------------------------------------
  async getSettings(): Promise<EventSettings> {
    try {
      const res = await databases.listDocuments<EventSettings>(DATABASE_ID, COLLECTIONS.EVENT_SETTINGS, [
        Query.limit(1)
      ]);
      if (res.documents.length > 0) {
        return res.documents[0];
      }
    } catch {}

    return {
      $id: "default",
      event_name: "CHIPOWER - Entrega Oficial de Kits",
      reader_ip: "192.168.0.33",
      banner_url: "",
      active: true
    };
  },

  async updateSettings(id: string, data: Partial<EventSettings>): Promise<EventSettings> {
    return await databases.updateDocument<EventSettings>(DATABASE_ID, COLLECTIONS.EVENT_SETTINGS, id, data);
  },

  // -----------------------------------------------------------
  // IMPORTAÇÃO EM LOTE ULTRA-RÁPIDA (COM EVENT_ID E 25 WORKERS)
  // -----------------------------------------------------------
  async batchImportParticipants(
    participantsList: Array<{
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
    let inserted = 0;
    let errors = 0;
    const total = participantsList.length;

    const cleanStr = (val?: string | number | null, max = 250): string | null => {
      if (val == null || val === "") return null;
      const s = String(val).trim();
      return s.length > max ? s.slice(0, max) : s;
    };

    const formatDate = (val?: any): string | null => {
      if (val == null || val === "") return null;
      if (typeof val === "number" && val > 10000 && val < 60000) {
        const date = new Date((val - 25569) * 86400 * 1000);
        const d = String(date.getUTCDate()).padStart(2, "0");
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const y = date.getUTCFullYear();
        return `${d}/${m}/${y}`;
      }
      const s = String(val).trim();
      if (s.includes("T")) {
        const parts = s.split("T")[0].split("-");
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return cleanStr(s, 30);
    };

    const CONCURRENCY = 25; // 25 conexões simultâneas em pipeline
    let completed = 0;

    // Pré-processamento e sanitização síncrona em memória
    const preparedPayloads = participantsList.map((p) => {
      const bib = cleanStr(p.bib_number, 30) || "0";
      const chip = (cleanStr(p.chip, 60) || bib).toUpperCase();
      const name = (cleanStr(p.name, 250) || "ATLETA").toUpperCase();
      const folded = normalizeFolded(name);
      const qr = cleanStr(p.qr_code, 480) || bib;

      return {
        bib_number: bib,
        chip: chip,
        name: name,
        name_folded: folded,
        cpf: cleanStr(p.cpf, 30),
        birth_date: formatDate(p.birth_date),
        sex: cleanStr(p.sex, 15)?.toUpperCase() || null,
        shirt: cleanStr(p.shirt, 30)?.toUpperCase() || null,
        modality: cleanStr(p.modality, 120),
        category: cleanStr(p.category, 120),
        qr_code: qr,
        event_id: eventId,
        event_name: eventName,
        delivered_at: null,
        receiver_name: null
      };
    });

    await runConcurrentPool(preparedPayloads, CONCURRENCY, async (payload) => {
      try {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          ID.unique(),
          payload
        );
        inserted++;
      } catch (err) {
        console.warn(`Erro ao importar ${payload.name} (#${payload.bib_number}):`, err);
        errors++;
      } finally {
        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
      }
    });

    return { inserted, errors };
  }
};

import { Client, Databases, Account, Query, Models } from "appwrite";
import { Participant, DeliveryAudit, EventSettings, DeliveryStats } from "../types";

export const APPWRITE_ENDPOINT = "https://db.largadabrasil.com/v1";
export const APPWRITE_PROJECT_ID = "6a8238cc001997d3b0c8";
export const DATABASE_ID = "chipower_entregas";

export const COLLECTIONS = {
  PARTICIPANTS: "participants",
  DELIVERY_AUDIT: "delivery_audit",
  EVENT_SETTINGS: "event_settings",
};

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const databases = new Databases(client);
export const account = new Account(client);

export const auth = {
  async login(email: string, password: string): Promise<Models.Session> {
    // Se houver uma sessão antiga ativa, encerra primeiro
    try {
      await account.deleteSession("current");
    } catch {}
    return await account.createEmailPasswordSession(email, password);
  },

  async getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
    try {
      // Timeout seguro de 1.2s para evitar que a tela inicial trave esperando resposta
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 1200)
      );
      const userPromise = account.get().catch(() => null);
      return await Promise.race([userPromise, timeoutPromise]);
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await account.deleteSession("current");
    } catch (e) {
      console.warn("Erro ao encerrar sessão:", e);
    }
  }
};

// Normalização de string para busca sem acentos
export function normalizeFolded(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export const api = {
  // 1. Participantes
  async searchParticipants(term: string): Promise<Participant[]> {
    const cleanTerm = term.trim();
    if (!cleanTerm) return [];

    const isNumeric = /^\d+$/.test(cleanTerm);
    const upper = cleanTerm.toUpperCase();
    const folded = normalizeFolded(cleanTerm);

    try {
      // Prioridade 1: Peito ou Chip exatos
      if (isNumeric) {
        const byBib = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
          Query.equal("bib_number", cleanTerm),
          Query.limit(5)
        ]);
        if (byBib.documents.length > 0) return byBib.documents;
      }

      // Prioridade 2: Busca por Chip exato ou QR Code
      const byChip = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        Query.equal("chip", upper),
        Query.limit(5)
      ]);
      if (byChip.documents.length > 0) return byChip.documents;

      try {
        const byQr = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
          Query.equal("qr_code", cleanTerm),
          Query.limit(5)
        ]);
        if (byQr.documents.length > 0) return byQr.documents;
      } catch {}

      // Prioridade 3: Busca por CPF
      if (cleanTerm.length >= 8) {
        const byCpf = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
          Query.contains("cpf", cleanTerm),
          Query.limit(10)
        ]);
        if (byCpf.documents.length > 0) return byCpf.documents;
      }

      // Prioridade 4: Busca por Nome
      const byName = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        Query.contains("name", upper),
        Query.limit(15)
      ]);
      if (byName.documents.length > 0) return byName.documents;

      // Prioridade 5: Busca por Name Folded
      const byFolded = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        Query.contains("name_folded", folded),
        Query.limit(15)
      ]);
      return byFolded.documents;
    } catch (err) {
      console.error("Erro na busca de participantes:", err);
      return [];
    }
  },

  async getParticipantById(id: string): Promise<Participant | null> {
    try {
      return await databases.getDocument<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, id);
    } catch {
      return null;
    }
  },

  async confirmDelivery(
    participant: Participant,
    operatorName: string,
    receiverName?: string
  ): Promise<{ success: boolean; participant: Participant }> {
    const now = new Date().toISOString();
    const finalReceiver = receiverName?.trim() || participant.name;

    // 1. Atualizar participante
    const updated = await databases.updateDocument<Participant>(
      DATABASE_ID,
      COLLECTIONS.PARTICIPANTS,
      participant.$id,
      {
        delivered_at: now,
        receiver_name: finalReceiver,
      }
    );

    // 2. Criar registro de auditoria imutável
    try {
      await databases.createDocument<DeliveryAudit>(
        DATABASE_ID,
        COLLECTIONS.DELIVERY_AUDIT,
        "unique()",
        {
          participant_id: participant.$id,
          epc: participant.chip,
          operator_name: operatorName || "Operador",
          receiver_name: finalReceiver,
          delivered_at: now,
        }
      );
    } catch (auditErr) {
      console.warn("Aviso ao salvar auditoria:", auditErr);
    }

    return { success: true, participant: updated };
  },

  async listParticipants(options?: {
    limit?: number;
    offset?: number;
    deliveredOnly?: boolean;
    pendingOnly?: boolean;
    search?: string;
  }): Promise<{ documents: Participant[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const queries: string[] = [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc("$updatedAt")
    ];

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

  async getRecentDeliveries(limit = 10): Promise<Participant[]> {
    try {
      const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        Query.isNotNull("delivered_at"),
        Query.orderDesc("delivered_at"),
        Query.limit(limit)
      ]);
      return res.documents;
    } catch (err) {
      console.error("Erro ao buscar entregas recentes:", err);
      return [];
    }
  },

  async getStats(): Promise<DeliveryStats> {
    try {
      // Total
      const totalRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        Query.limit(1)
      ]);
      const total = totalRes.total;

      // Entregues
      const deliveredRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        Query.isNotNull("delivered_at"),
        Query.limit(1)
      ]);
      const delivered = deliveredRes.total;

      const pending = Math.max(0, total - delivered);
      const percentage = total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 0;

      return {
        total,
        delivered,
        pending,
        percentage,
        deliveriesLastHour: delivered // Simplificado
      };
    } catch (err) {
      console.error("Erro ao buscar estatísticas:", err);
      return { total: 0, delivered: 0, pending: 0, percentage: 0, deliveriesLastHour: 0 };
    }
  },

  // 2. Configurações
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

  // 3. Importação em Lote
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
    onProgress?: (current: number, total: number) => void
  ): Promise<{ inserted: number; errors: number }> {
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < participantsList.length; i++) {
      const p = participantsList[i];
      try {
        const folded = normalizeFolded(p.name);
        const qr = p.qr_code ? String(p.qr_code).trim() : String(p.bib_number).trim();
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          "unique()",
          {
            bib_number: String(p.bib_number).trim(),
            chip: String(p.chip).trim().toUpperCase(),
            name: String(p.name).trim().toUpperCase(),
            name_folded: folded,
            cpf: p.cpf ? String(p.cpf).trim() : null,
            birth_date: p.birth_date ? String(p.birth_date).trim() : null,
            sex: p.sex ? String(p.sex).trim().toUpperCase() : null,
            shirt: p.shirt ? String(p.shirt).trim().toUpperCase() : null,
            modality: p.modality ? String(p.modality).trim() : null,
            category: p.category ? String(p.category).trim() : null,
            qr_code: qr,
            delivered_at: null,
            receiver_name: null
          }
        );
        inserted++;
      } catch (err) {
        console.warn(`Erro ao importar ${p.name}:`, err);
        errors++;
      }

      if (onProgress) {
        onProgress(i + 1, participantsList.length);
      }
    }

    return { inserted, errors };
  }
};

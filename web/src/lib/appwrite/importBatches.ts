import { Query, ID } from "appwrite";
import { databases, DATABASE_ID } from "./client";
import { requireTenant, tenantScope, tenantDocumentPermissions } from "./tenancy";
import { ImportBatch } from "../../types";

const COLLECTION = "import_batches";

/**
 * Histórico de planilhas anexadas a cada evento.
 *
 * Quando chegam mais inscritos, a lista nova é somada ao evento que já existe
 * — e não vira uma tabela separada. Sem este registro, porém, olhando a aba
 * não há como saber que aquele total veio de dois ou três anexos. É o que
 * alimenta a expansão da aba na barra de tabelas.
 */
export const importBatchesApi = {
  async registrarImportacao(dados: {
    eventId: string;
    eventName: string;
    fileName: string;
    inserted: number;
    updated: number;
    skipped: number;
  }): Promise<void> {
    const tenant = requireTenant();

    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION,
        ID.unique(),
        {
          tenant_id: tenant.tenantId,
          event_id: dados.eventId,
          event_name: dados.eventName.slice(0, 250),
          file_name: (dados.fileName || "planilha").slice(0, 250),
          owner_id: tenant.userId,
          owner_name: tenant.userName.slice(0, 250),
          inserted: dados.inserted,
          updated: dados.updated,
          skipped: dados.skipped
        },
        tenantDocumentPermissions()
      );
    } catch (err) {
      // O histórico é informativo: se falhar, a importação em si continua boa.
      console.warn("Não foi possível registrar o histórico desta importação:", err);
    }
  },

  async listarPorEvento(eventId: string): Promise<ImportBatch[]> {
    try {
      const res = await databases.listDocuments<ImportBatch>(DATABASE_ID, COLLECTION, [
        ...tenantScope(),
        Query.equal("event_id", eventId),
        Query.orderDesc("$createdAt"),
        Query.limit(50)
      ]);
      return res.documents;
    } catch (err) {
      console.warn("Não foi possível carregar o histórico de anexos:", err);
      return [];
    }
  },

  /** Quantos anexos cada evento recebeu, para o contador da aba. */
  async contarPorEvento(eventIds: string[]): Promise<Record<string, number>> {
    if (eventIds.length === 0) return {};

    try {
      const res = await databases.listDocuments<ImportBatch>(DATABASE_ID, COLLECTION, [
        ...tenantScope(),
        Query.equal("event_id", eventIds),
        Query.select(["event_id"]),
        Query.limit(500)
      ]);

      return res.documents.reduce<Record<string, number>>((mapa, doc) => {
        mapa[doc.event_id] = (mapa[doc.event_id] || 0) + 1;
        return mapa;
      }, {});
    } catch (err) {
      console.warn("Não foi possível contar os anexos por evento:", err);
      return {};
    }
  }
};

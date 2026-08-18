import { Query, ID } from "appwrite";
import { databases, DATABASE_ID, COLLECTIONS, runConcurrentPool } from "./client";
import {
  requireTenant,
  tenantScope,
  ownerScope,
  tenantDocumentPermissions,
  setVisibleEventIds
} from "./tenancy";
import { EventItem, Participant } from "../../types";

const limitarTexto = (valor: string | undefined | null, max: number) =>
  valor ? valor.trim().slice(0, max) : null;

export const eventsApi = {
  /**
   * Lista as tabelas/eventos visíveis para o usuário, já com a contagem de
   * atletas e de kits entregues de cada uma.
   */
  async listEvents(): Promise<EventItem[]> {
    try {
      const res = await databases.listDocuments<EventItem>(DATABASE_ID, COLLECTIONS.EVENTS, [
        ...tenantScope(),
        ...ownerScope(),
        Query.orderDesc("$createdAt"),
        Query.limit(100)
      ]);

      // Mantém a lista de eventos visíveis em dia para o escopo de participantes.
      setVisibleEventIds(res.documents.map((ev) => ev.$id));

      const comContagens = await Promise.all(
        res.documents.map(async (ev) => {
          try {
            const [total, entregues] = await Promise.all([
              databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
                ...tenantScope(),
                Query.equal("event_id", ev.$id),
                Query.limit(1)
              ]),
              databases.listDocuments(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
                ...tenantScope(),
                Query.equal("event_id", ev.$id),
                Query.isNotNull("delivered_at"),
                Query.limit(1)
              ])
            ]);

            return { ...ev, total_athletes: total.total, delivered_athletes: entregues.total };
          } catch {
            return ev;
          }
        })
      );

      return comContagens;
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
    const tenant = requireTenant();

    return databases.createDocument<EventItem>(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      ID.unique(),
      {
        name: data.name.trim().slice(0, 250),
        event_date: limitarTexto(data.event_date, 30),
        location: limitarTexto(data.location, 250),
        description: limitarTexto(data.description, 500),
        is_active: true,
        tenant_id: tenant.tenantId,
        owner_id: tenant.userId,
        owner_name: tenant.userName
      },
      tenantDocumentPermissions()
    );
  },

  async updateEvent(
    id: string,
    data: Partial<{
      name: string;
      event_date: string;
      location: string;
      description: string;
      is_active: boolean;
    }>
  ): Promise<EventItem> {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name.trim().slice(0, 250);
    if (data.event_date !== undefined) payload.event_date = limitarTexto(data.event_date, 30);
    if (data.location !== undefined) payload.location = limitarTexto(data.location, 250);
    if (data.description !== undefined) payload.description = limitarTexto(data.description, 500);
    if (data.is_active !== undefined) payload.is_active = data.is_active;

    const atualizado = await databases.updateDocument<EventItem>(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      id,
      payload
    );

    // Renomear a prova precisa refletir no cache desnormalizado dos atletas.
    if (data.name) {
      try {
        const atletas = await databases.listDocuments<Participant>(
          DATABASE_ID,
          COLLECTIONS.PARTICIPANTS,
          [...tenantScope(), Query.equal("event_id", id), Query.select(["$id"]), Query.limit(5000)]
        );

        await runConcurrentPool(atletas.documents, 20, (doc) =>
          databases.updateDocument(DATABASE_ID, COLLECTIONS.PARTICIPANTS, doc.$id, {
            event_name: data.name!.trim().slice(0, 250)
          })
        );
      } catch (err) {
        console.warn("Aviso ao sincronizar o nome nos atletas:", err);
      }
    }

    return atualizado;
  },

  async deleteEvent(
    id: string,
    removerAtletas: (eventId: string, onProgress?: (c: number, t: number) => void) => Promise<unknown>,
    onProgress?: (current: number, total: number) => void
  ): Promise<boolean> {
    try {
      await removerAtletas(id, onProgress);
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EVENTS, id);
      return true;
    } catch (err) {
      console.error("Erro ao excluir evento:", err);
      return false;
    }
  }
};

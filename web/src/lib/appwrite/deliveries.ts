import { Query, ID } from "appwrite";
import { databases, DATABASE_ID, COLLECTIONS } from "./client";
import { requireTenant, tenantScope, eventScope, tenantDocumentPermissions } from "./tenancy";
import { Participant, DeliveryAudit } from "../../types";

export const deliveriesApi = {
  /**
   * Marca o kit como entregue e grava a trilha de auditoria.
   *
   * A auditoria é best-effort: se ela falhar, a entrega em si não é revertida —
   * na operação de balcão, travar a fila por causa de um log é pior que o log
   * faltando. A falha vai para o console e o registro principal fica íntegro.
   */
  async deliverKit(
    participante: Participant,
    operatorName: string,
    receiverName?: string
  ): Promise<{ success: boolean; participant?: Participant }> {
    const tenant = requireTenant();
    const agora = new Date().toISOString();
    const recebedor = receiverName?.trim() || participante.name;

    const atualizado = await databases.updateDocument<Participant>(
      DATABASE_ID,
      COLLECTIONS.PARTICIPANTS,
      participante.$id,
      { delivered_at: agora, receiver_name: recebedor }
    );

    try {
      await databases.createDocument<DeliveryAudit>(
        DATABASE_ID,
        COLLECTIONS.DELIVERY_AUDIT,
        ID.unique(),
        {
          participant_id: participante.$id,
          epc: participante.chip,
          operator_name: operatorName || tenant.userName,
          operator_id: tenant.userId,
          receiver_name: recebedor,
          delivered_at: agora,
          event_id: participante.event_id || null,
          tenant_id: tenant.tenantId
        },
        tenantDocumentPermissions()
      );
    } catch (err) {
      console.warn("Aviso ao gravar auditoria da entrega:", err);
    }

    return { success: true, participant: atualizado };
  },

  async getRecentDeliveries(limit = 10, eventId?: string | null): Promise<Participant[]> {
    try {
      const res = await databases.listDocuments<Participant>(DATABASE_ID, COLLECTIONS.PARTICIPANTS, [
        ...tenantScope(),
        ...eventScope(eventId),
        Query.isNotNull("delivered_at"),
        Query.orderDesc("delivered_at"),
        Query.limit(limit)
      ]);
      return res.documents;
    } catch (err) {
      console.error("Erro ao buscar entregas recentes:", err);
      return [];
    }
  }
};

import { Query, ID } from "appwrite";
import { databases, DATABASE_ID, COLLECTIONS } from "./client";
import { requireTenant, tenantScope, tenantDocumentPermissions } from "./tenancy";
import { EventSettings, documentoVazio } from "../../types";

const PADRAO: EventSettings = {
  ...documentoVazio("default"),
  event_name: "CHIPOWER - Entrega Oficial de Kits",
  reader_ip: "192.168.0.33",
  banner_url: "",
  active: true
};

export const settingsApi = {
  /** Configuração do ambiente. Cada tenant tem a sua; nunca há fallback global. */
  async getSettings(): Promise<EventSettings> {
    try {
      const res = await databases.listDocuments<EventSettings>(
        DATABASE_ID,
        COLLECTIONS.EVENT_SETTINGS,
        [...tenantScope(), Query.limit(1)]
      );

      if (res.documents.length > 0) return res.documents[0];
    } catch (err) {
      console.warn("Aviso ao carregar configurações:", err);
    }

    return PADRAO;
  },

  async updateSettings(id: string, data: Partial<EventSettings>): Promise<EventSettings> {
    const tenant = requireTenant();

    // Ambiente ainda sem documento de configuração: cria o primeiro.
    if (!id || id === "default") {
      return databases.createDocument<EventSettings>(
        DATABASE_ID,
        COLLECTIONS.EVENT_SETTINGS,
        ID.unique(),
        {
          event_name: data.event_name || PADRAO.event_name,
          reader_ip: data.reader_ip || PADRAO.reader_ip,
          banner_url: data.banner_url || "",
          active: data.active ?? true,
          tenant_id: tenant.tenantId
        },
        tenantDocumentPermissions()
      );
    }

    const payload: Record<string, any> = {};
    if (data.event_name !== undefined) payload.event_name = data.event_name;
    if (data.reader_ip !== undefined) payload.reader_ip = data.reader_ip;
    if (data.banner_url !== undefined) payload.banner_url = data.banner_url;
    if (data.active !== undefined) payload.active = data.active;

    return databases.updateDocument<EventSettings>(
      DATABASE_ID,
      COLLECTIONS.EVENT_SETTINGS,
      id,
      payload
    );
  }
};

import { Models } from "appwrite";

/**
 * Modelos de domínio.
 *
 * Todos estendem `Models.Document` porque são documentos do Appwrite de fato —
 * isso mantém os genéricos do SDK tipados de ponta a ponta e evita cast solto.
 * `tenant_id` e `owner_id` são o que garante que um ambiente nunca enxergue o
 * outro; nenhuma consulta da aplicação sai sem eles.
 */

export interface EventItem extends Models.Document {
  name: string;
  event_date?: string;
  location?: string;
  description?: string;
  is_active?: boolean;
  tenant_id?: string;
  owner_id?: string;
  owner_name?: string;
  /** Calculados na listagem, não persistidos. */
  total_athletes?: number;
  delivered_athletes?: number;
}

export interface Participant extends Models.Document {
  bib_number: string;
  chip: string;
  name: string;
  name_folded?: string;
  cpf?: string;
  birth_date?: string;
  sex?: string;
  shirt?: string;
  modality?: string;
  category?: string;
  qr_code?: string;
  delivered_at?: string | null;
  receiver_name?: string | null;
  event_id?: string;
  event_name?: string;
  tenant_id?: string;
  owner_id?: string;
}

export interface DeliveryAudit extends Models.Document {
  participant_id: string;
  epc: string;
  operator_name: string;
  operator_id?: string;
  receiver_name?: string;
  delivered_at: string;
  event_id?: string | null;
  tenant_id?: string;
}

export interface EventSettings extends Models.Document {
  event_name: string;
  reader_ip?: string;
  banner_url?: string;
  active?: boolean;
  tenant_id?: string;
}

export interface OperatorUser extends Models.Document {
  user_id?: string;
  name: string;
  email: string;
  role: "admin" | "operador";
  is_active: boolean;
  tenant_id?: string;
  created_by?: string;
  /** Chaves do catálogo em `lib/permissions.ts`. */
  permissions?: string[];
}

export interface Tenant extends Models.Document {
  name: string;
  owner_user_id: string;
  team_id: string;
  is_active?: boolean;
}

export interface DeliveryStats {
  total: number;
  delivered: number;
  pending: number;
  percentage: number;
  deliveriesLastHour: number;
  eventId?: string | null;
  eventName?: string | null;
}

/** Metadados neutros para montar um documento "de fachada" antes de existir no banco. */
export const documentoVazio = (id: string): Models.Document => ({
  $id: id,
  $sequence: 0,
  $collectionId: "",
  $databaseId: "",
  $createdAt: "",
  $updatedAt: "",
  $permissions: []
});

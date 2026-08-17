export interface EventItem {
  $id: string;
  name: string;
  event_date?: string;
  location?: string;
  description?: string;
  is_active?: boolean;
  $createdAt?: string;
  $updatedAt?: string;
  total_athletes?: number;
  delivered_athletes?: number;
}

export interface Participant {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
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
}

export interface DeliveryAudit {
  $id: string;
  $createdAt: string;
  participant_id: string;
  epc: string;
  operator_name: string;
  receiver_name?: string;
  delivered_at: string;
}

export interface EventSettings {
  $id: string;
  event_name: string;
  reader_ip?: string;
  banner_url?: string;
  active?: boolean;
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

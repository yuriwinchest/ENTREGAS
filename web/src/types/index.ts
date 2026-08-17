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
  delivered_at?: string | null;
  receiver_name?: string | null;
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
}

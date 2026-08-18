/**
 * Fachada da camada de dados.
 *
 * O objeto `api` mantém a mesma superfície que os componentes já consomem —
 * a diferença é que agora cada chamada nasce presa ao tenant do usuário logado.
 */

import { eventsApi } from "./events";
import { participantsApi } from "./participants";
import { deliveriesApi } from "./deliveries";
import { settingsApi } from "./settings";

export {
  client,
  databases,
  account,
  functions,
  DATABASE_ID,
  COLLECTIONS,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  ADMIN_FUNCTION_ID,
  normalizeFolded,
  runConcurrentPool
} from "./client";

export { auth } from "./auth";

export {
  setTenantContext,
  getTenantContext,
  requireTenant,
  can,
  setVisibleEventIds,
  getVisibleEventIds,
  SemTenantError
} from "./tenancy";

export type { TenantContext } from "./tenancy";

export const api = {
  ...eventsApi,
  ...participantsApi,
  ...deliveriesApi,
  ...settingsApi,

  /** Exclui a prova e, junto, todos os atletas vinculados a ela. */
  deleteEvent: (id: string, onProgress?: (current: number, total: number) => void) =>
    eventsApi.deleteEvent(id, participantsApi.deleteAllParticipants, onProgress),

  /** Alias histórico usado pelo balcão de entrega. */
  confirmDelivery: deliveriesApi.deliverKit
};

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
import { importBatchesApi } from "./importBatches";

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

export { createDocumentsInBatches } from "./bulk";

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
  ...importBatchesApi,

  /** Alias histórico usado pelo balcão de entrega. */
  confirmDelivery: deliveriesApi.deliverKit
};

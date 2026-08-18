import { Client, Databases, Account, Functions } from "appwrite";

// Configurações do Appwrite (instância dedicada CHIPOWER)
export const APPWRITE_ENDPOINT = "https://db.largadabrasil.com/v1";
export const APPWRITE_PROJECT_ID = "6a8238cc001997d3b0c8";
export const DATABASE_ID = "chipower_entregas";
export const ADMIN_FUNCTION_ID = "admin-api";

export const COLLECTIONS = {
  PARTICIPANTS: "participants",
  DELIVERY_AUDIT: "delivery_audit",
  EVENT_SETTINGS: "event_settings",
  EVENTS: "events",
  OPERATORS: "operators",
  TENANTS: "tenants"
};

export const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

export const databases = new Databases(client);
export const account = new Account(client);
export const functions = new Functions(client);

/** Normalização para busca sem acentos e case-insensitive. */
export const normalizeFolded = (str: string): string =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

/**
 * Fila de trabalho com concorrência limitada.
 * Usada nas operações em lote (importação, exclusão, reset) para saturar a
 * banda sem derrubar o servidor nem travar a aba do navegador.
 */
export async function runConcurrentPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const poolWorkers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        console.warn(`Falha no item ${index} do lote:`, err);
      }
    }
  });

  await Promise.all(poolWorkers);
  return results;
}

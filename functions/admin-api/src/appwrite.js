/**
 * Camada fina de acesso à REST API do Appwrite usada dentro da Function.
 *
 * Dois modos de chamada:
 *  - `admin()`  : usa a API key (privilegiado, roda só aqui dentro do servidor)
 *  - `asUser()` : usa o JWT do chamador (serve para PROVAR quem está chamando)
 */

const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "chipower_entregas";

export const COLLECTIONS = {
  TENANTS: "tenants",
  OPERATORS: "operators",
  EVENTS: "events",
  PARTICIPANTS: "participants",
  AUDIT: "delivery_audit",
  SETTINGS: "event_settings"
};

export class ApiError extends Error {
  constructor(status, message, type) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

async function call(path, { method = "GET", body = null, headers = {} } = {}) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: {
      "X-Appwrite-Project": PROJECT_ID,
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) throw new ApiError(res.status, data.message || "Falha na API do Appwrite", data.type);
  return data;
}

export const admin = (path, options = {}) =>
  call(path, { ...options, headers: { ...options.headers, "X-Appwrite-Key": API_KEY } });

export const asUser = (path, jwt, options = {}) =>
  call(path, { ...options, headers: { ...options.headers, "X-Appwrite-JWT": jwt } });

export const q = {
  limit: (n) => JSON.stringify({ method: "limit", values: [n] }),
  offset: (n) => JSON.stringify({ method: "offset", values: [n] }),
  equal: (attribute, values) => JSON.stringify({ method: "equal", attribute, values: [].concat(values) }),
  orderDesc: (attribute) => JSON.stringify({ method: "orderDesc", attribute }),
  isNotNull: (attribute) => JSON.stringify({ method: "isNotNull", attribute })
};

export const qs = (queries) => queries.map((item) => `queries[]=${encodeURIComponent(item)}`).join("&");

export const docs = {
  list: (collectionId, queries = []) =>
    admin(`/databases/${DATABASE_ID}/collections/${collectionId}/documents?${qs(queries)}`),

  get: (collectionId, documentId) =>
    admin(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`),

  create: (collectionId, documentId, data, permissions) =>
    admin(`/databases/${DATABASE_ID}/collections/${collectionId}/documents`, {
      method: "POST",
      body: { documentId, data, permissions }
    }),

  update: (collectionId, documentId, data, permissions) =>
    admin(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`, {
      method: "PATCH",
      body: permissions ? { data, permissions } : { data }
    }),

  remove: (collectionId, documentId) =>
    admin(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`, {
      method: "DELETE"
    })
};

/** Permissões de documento que dão acesso a todo o Team do tenant. */
export const tenantDocPermissions = (teamId) => [
  `read("team:${teamId}")`,
  `update("team:${teamId}")`,
  `delete("team:${teamId}")`
];

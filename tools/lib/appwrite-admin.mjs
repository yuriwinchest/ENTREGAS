/**
 * Cliente administrativo do Appwrite para os scripts de provisionamento.
 *
 * A chave de API NUNCA fica no código: é lida de APPWRITE_API_KEY. Rode assim:
 *   APPWRITE_API_KEY="standard_xxx" node tools/provision_tenancy.mjs
 */

export const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://db.largadabrasil.com/v1";
export const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "6a8238cc001997d3b0c8";
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "chipower_entregas";

const API_KEY = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
  console.error("\n[ERRO] Variável APPWRITE_API_KEY não definida.");
  console.error('Uso: APPWRITE_API_KEY="standard_..." node tools/<script>.mjs\n');
  process.exit(1);
}

const baseHeaders = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

export class AppwriteError extends Error {
  constructor(status, payload) {
    super(`[${status}] ${payload?.message || "Falha na API do Appwrite"}`);
    this.status = status;
    this.type = payload?.type;
    this.payload = payload;
  }
}

export async function request(path, method = "GET", body = null) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: baseHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) throw new AppwriteError(res.status, data);
  return data;
}

/** Executa e engole conflitos de recurso já existente (idempotência dos scripts). */
export async function requestIdempotent(path, method, body, label) {
  try {
    const data = await request(path, method, body);
    console.log(`  [+] ${label}`);
    return data;
  } catch (err) {
    if (err.status === 409) {
      console.log(`  [=] ${label} (já existia)`);
      return null;
    }
    throw err;
  }
}

export const query = {
  limit: (n) => JSON.stringify({ method: "limit", values: [n] }),
  offset: (n) => JSON.stringify({ method: "offset", values: [n] }),
  equal: (attr, values) => JSON.stringify({ method: "equal", attribute: attr, values: [].concat(values) }),
  isNull: (attr) => JSON.stringify({ method: "isNull", attribute: attr }),
  select: (attrs) => JSON.stringify({ method: "select", values: attrs })
};

export function queryString(queries) {
  return queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
}

/** Lista TODOS os documentos de uma collection paginando por offset. */
export async function listAllDocuments(collectionId, extraQueries = [], pageSize = 100) {
  const all = [];
  let offset = 0;

  for (;;) {
    const qs = queryString([...extraQueries, query.limit(pageSize), query.offset(offset)]);
    const page = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents?${qs}`);
    all.push(...page.documents);
    if (page.documents.length < pageSize || all.length >= page.total) break;
    offset += pageSize;
  }

  return all;
}

/** Pool de concorrência para operações em lote sem estourar o servidor. */
export async function pool(items, concurrency, worker) {
  let cursor = 0;
  let done = 0;
  const failures = [];

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        await worker(items[index], index);
      } catch (err) {
        failures.push({ index, error: err.message });
      }
      done++;
    }
  });

  await Promise.all(runners);
  return { done, failures };
}

/** Aguarda um atributo sair de "processing" antes de criar índices sobre ele. */
export async function waitForAttribute(collectionId, key, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const attr = await request(
        `/databases/${DATABASE_ID}/collections/${collectionId}/attributes/${key}`
      );
      if (attr.status === "available") return true;
      if (attr.status === "failed") throw new Error(`Atributo ${collectionId}.${key} falhou ao ser criado`);
    } catch (err) {
      if (err.status !== 404) throw err;
    }
    await new Promise((r) => setTimeout(r, 900));
  }

  throw new Error(`Timeout aguardando atributo ${collectionId}.${key}`);
}

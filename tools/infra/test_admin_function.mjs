/**
 * Teste de ponta a ponta da Function admin-api usando uma sessão real.
 *
 * Uso:
 *   APPWRITE_API_KEY="standard_..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." \
 *     node tools/infra/test_admin_function.mjs
 */

import { ENDPOINT, PROJECT_ID, request } from "../lib/appwrite-admin.mjs";

const EMAIL = process.env.ADMIN_EMAIL || "alinepedrosa001@gmail.com";
const SENHA = process.env.ADMIN_PASSWORD;

if (!SENHA) {
  console.error('Defina ADMIN_PASSWORD="..." para rodar o teste.');
  process.exit(1);
}

const base = { "X-Appwrite-Project": PROJECT_ID, "Content-Type": "application/json" };

async function comSessao(path, cookie, method = "POST", body = null) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: { ...base, Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`[${res.status}] ${data.message || res.statusText}`);
  return data;
}

async function chamar(jwt, payload) {
  const exec = await request(`/functions/admin-api/executions`, "POST", {
    body: JSON.stringify({ ...payload, jwt }),
    async: false,
    path: "/",
    method: "POST"
  });

  let corpo;
  try {
    corpo = JSON.parse(exec.responseBody || "{}");
  } catch {
    corpo = { raw: exec.responseBody };
  }

  return { status: exec.responseStatusCode, corpo, logs: exec.logs, errors: exec.errors };
}

async function main() {
  console.log("1. Autenticando como", EMAIL);
  const resposta = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: base,
    body: JSON.stringify({ email: EMAIL, password: SENHA })
  });

  const sessao = await resposta.json();
  if (!resposta.ok) throw new Error(sessao.message);

  // A sessão de cliente vive em cookie — o secret não vem no corpo.
  const cookie = (resposta.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  console.log("   sessão criada:", sessao.$id);

  const jwt = (await comSessao("/account/jwts", cookie)).jwt;
  console.log("   JWT emitido\n");

  console.log("2. bootstrap");
  const boot = await chamar(jwt, { action: "bootstrap" });
  console.log("   status:", boot.status);
  console.log("   ", JSON.stringify(boot.corpo).slice(0, 700));
  if (boot.errors) console.log("   errors:", boot.errors.slice(0, 500));

  console.log("\n3. listOperators");
  const lista = await chamar(jwt, { action: "listOperators" });
  console.log("   status:", lista.status);
  console.log("   ", JSON.stringify(lista.corpo?.operators?.map((o) => `${o.name}/${o.role}`) || lista.corpo));

  console.log("\n4. ação inválida (deve recusar)");
  const ruim = await chamar(jwt, { action: "naoExiste" });
  console.log("   status:", ruim.status, JSON.stringify(ruim.corpo).slice(0, 200));

  console.log("\n5. chamada sem credencial (deve recusar com 401)");
  const semAuth = await chamar(undefined, { action: "listOperators" });
  console.log("   status:", semAuth.status, JSON.stringify(semAuth.corpo).slice(0, 200));

  await comSessao("/account/sessions/current", cookie, "DELETE").catch(() => {});
  console.log("\n=== TESTE FINALIZADO ===");
}

main().catch((err) => {
  console.error("[FALHA]", err.message);
  process.exit(1);
});

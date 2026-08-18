/**
 * Teste de ponta a ponta do isolamento multi-tenant e do RBAC.
 *
 * Percurso coberto:
 *   1. admin cria um operador com permissões restritas;
 *   2. o operador loga, faz bootstrap e recebe SÓ o que foi concedido;
 *   3. o operador é barrado ao tentar uma ação de administrador;
 *   4. o operador desativado perde o acesso de fato (no servidor);
 *   5. limpeza: o operador de teste é removido.
 *
 * Uso:
 *   APPWRITE_API_KEY="standard_..." ADMIN_PASSWORD="..." node tools/infra/test_tenancy_e2e.mjs
 */

import { ENDPOINT, PROJECT_ID, request } from "../lib/appwrite-admin.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alinepedrosa001@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const TESTE_EMAIL = process.env.TEST_EMAIL || "teste.operador.chipower@exemplo.com";
const TESTE_SENHA = "Operador@Teste2026";

if (!ADMIN_PASSWORD) {
  console.error('Defina ADMIN_PASSWORD="..." para rodar o teste.');
  process.exit(1);
}

const base = { "X-Appwrite-Project": PROJECT_ID, "Content-Type": "application/json" };

let falhas = 0;
const checar = (descricao, condicao, extra = "") => {
  console.log(`   ${condicao ? "OK " : "FALHOU"}  ${descricao}${extra ? ` — ${extra}` : ""}`);
  if (!condicao) falhas++;
};

async function autenticar(email, senha) {
  const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: base,
    body: JSON.stringify({ email, password: senha })
  });

  const corpo = await res.json();
  if (!res.ok) throw new Error(`login ${email}: ${corpo.message}`);

  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const jwtRes = await fetch(`${ENDPOINT}/account/jwts`, {
    method: "POST",
    headers: { ...base, Cookie: cookie }
  });
  const jwtBody = await jwtRes.json();
  if (!jwtRes.ok) throw new Error(`jwt ${email}: ${jwtBody.message}`);

  return { cookie, jwt: jwtBody.jwt };
}

async function chamar(jwt, payload) {
  const exec = await request("/functions/admin-api/executions", "POST", {
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

  return { status: exec.responseStatusCode, corpo };
}

async function limparOperadorDeTeste() {
  const busca = await request(
    `/users?queries[]=${encodeURIComponent(JSON.stringify({ method: "equal", attribute: "email", values: [TESTE_EMAIL] }))}`
  );

  for (const u of busca.users || []) {
    await request(`/users/${u.$id}`, "DELETE").catch(() => {});
  }

  const docs = await request(
    `/databases/chipower_entregas/collections/operators/documents?queries[]=${encodeURIComponent(
      JSON.stringify({ method: "equal", attribute: "email", values: [TESTE_EMAIL] })
    )}`
  );

  for (const d of docs.documents || []) {
    await request(`/databases/chipower_entregas/collections/operators/documents/${d.$id}`, "DELETE").catch(
      () => {}
    );
  }
}

async function main() {
  console.log("=== TESTE E2E DE TENANCY E PERMISSÕES ===\n");

  await limparOperadorDeTeste();

  console.log("1. Autenticando o administrador");
  const admin = await autenticar(ADMIN_EMAIL, ADMIN_PASSWORD);
  const bootAdmin = await chamar(admin.jwt, { action: "bootstrap" });
  checar("bootstrap do admin responde 200", bootAdmin.status === 200);
  checar("admin tem team.manage", bootAdmin.corpo.permissions?.includes("team.manage"));
  const tenantId = bootAdmin.corpo.tenant?.id;
  checar("admin está vinculado a um tenant", Boolean(tenantId), tenantId);

  console.log("\n2. Criando operador com permissões restritas");
  const criacao = await chamar(admin.jwt, {
    action: "createOperator",
    name: "Operador de Teste",
    email: TESTE_EMAIL,
    password: TESTE_SENHA,
    role: "operador",
    permissions: ["tab.desk", "delivery.confirm", "team.manage"]
  });

  checar("criação responde 200", criacao.status === 200, criacao.corpo?.message || "");
  const operatorId = criacao.corpo.operator?.$id;
  const permissoesGravadas = criacao.corpo.operator?.permissions || [];
  checar("operador nasce no mesmo tenant", criacao.corpo.operator?.tenant_id === tenantId);
  checar(
    "servidor removeu team.manage de um não-administrador",
    !permissoesGravadas.includes("team.manage"),
    permissoesGravadas.join(", ")
  );

  console.log("\n3. Operador autentica e recebe apenas o que foi concedido");
  const operador = await autenticar(TESTE_EMAIL, TESTE_SENHA);
  const bootOperador = await chamar(operador.jwt, { action: "bootstrap" });
  checar("bootstrap do operador responde 200", bootOperador.status === 200);
  checar("operador está no tenant do admin", bootOperador.corpo.tenant?.id === tenantId);
  checar(
    "operador NÃO recebe tab.participants (não concedida)",
    !bootOperador.corpo.permissions?.includes("tab.participants"),
    (bootOperador.corpo.permissions || []).join(", ")
  );

  console.log("\n4. Operador é barrado em ação de administrador");
  const tentativa = await chamar(operador.jwt, { action: "listOperators" });
  checar("listOperators é recusado com 403", tentativa.status === 403, tentativa.corpo?.message || "");

  const escalada = await chamar(operador.jwt, {
    action: "updateOperator",
    operatorId,
    permissions: ["team.manage", "data.purge"]
  });
  checar("tentativa de auto-promoção é recusada", escalada.status === 403, escalada.corpo?.message || "");

  console.log("\n5. Desativação bloqueia o acesso no servidor");
  const desativacao = await chamar(admin.jwt, { action: "updateOperator", operatorId, is_active: false });
  checar("desativação responde 200", desativacao.status === 200, desativacao.corpo?.message || "");

  let loginBloqueado = false;
  try {
    await autenticar(TESTE_EMAIL, TESTE_SENHA);
  } catch {
    loginBloqueado = true;
  }
  checar("operador desativado não consegue mais autenticar", loginBloqueado);

  console.log("\n6. Limpeza");
  const exclusao = await chamar(admin.jwt, { action: "deleteOperator", operatorId });
  checar("exclusão responde 200", exclusao.status === 200, exclusao.corpo?.message || "");
  await limparOperadorDeTeste();

  console.log(`\n=== ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} TESTE(S) FALHARAM`} ===`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("\n[FALHA]", err.message);
  await limparOperadorDeTeste().catch(() => {});
  process.exit(1);
});

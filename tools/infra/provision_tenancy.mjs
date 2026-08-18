/**
 * Provisiona o modelo multi-tenant (multi-empresa / multi-operador) no Appwrite.
 *
 * O que este script faz (é idempotente, pode rodar quantas vezes precisar):
 *   1. Cria a collection `tenants` (ambientes isolados).
 *   2. Adiciona tenant_id / owner_id nas collections operacionais.
 *   3. Adiciona `permissions` (array) e `tenant_id` em `operators`.
 *   4. Cria os índices necessários para consultas rápidas por tenant.
 *   5. Cria o Team do Appwrite que representa o tenant (isolamento server-side real).
 *   6. Faz o backfill de todos os dados existentes para o tenant do administrador.
 *
 * Uso:
 *   APPWRITE_API_KEY="standard_..." node tools/infra/provision_tenancy.mjs
 */

import {
  DATABASE_ID,
  request,
  requestIdempotent,
  listAllDocuments,
  pool,
  waitForAttribute,
  query,
  queryString
} from "../lib/appwrite-admin.mjs";

// E-mail do administrador raiz que será dono do tenant principal.
const ROOT_ADMIN_EMAIL = process.env.ROOT_ADMIN_EMAIL || "alinepedrosa001@gmail.com";
const ROOT_TENANT_NAME = process.env.ROOT_TENANT_NAME || "CHIPOWER Entregas";

const COL = {
  TENANTS: "tenants",
  OPERATORS: "operators",
  EVENTS: "events",
  PARTICIPANTS: "participants",
  AUDIT: "delivery_audit",
  SETTINGS: "event_settings"
};

// Permissões concedidas ao administrador dono do tenant.
const ADMIN_PERMISSIONS = [
  "tab.desk",
  "tab.telao",
  "tab.participants",
  "tab.settings",
  "event.create",
  "event.edit",
  "event.delete",
  "event.view_all",
  "athlete.import",
  "athlete.export",
  "athlete.edit",
  "athlete.delete",
  "data.purge",
  "data.reset",
  "delivery.confirm",
  "team.manage"
];

const OPERATOR_PERMISSIONS = [
  "tab.desk",
  "tab.telao",
  "tab.participants",
  "athlete.export",
  "delivery.confirm"
];

// ---------------------------------------------------------------------------
// Helpers de schema
// ---------------------------------------------------------------------------

async function ensureCollection(id, name) {
  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections`,
    "POST",
    {
      collectionId: id,
      name,
      permissions: ['create("users")'],
      documentSecurity: true,
      enabled: true
    },
    `collection ${id}`
  );
}

async function ensureStringAttribute(collectionId, key, size, { required = false, array = false } = {}) {
  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${collectionId}/attributes/string`,
    "POST",
    { key, size, required, default: required || array ? null : null, array },
    `${collectionId}.${key} (string ${size}${array ? "[]" : ""})`
  );
  await waitForAttribute(collectionId, key);
}

async function ensureBooleanAttribute(collectionId, key, defaultValue = true) {
  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${collectionId}/attributes/boolean`,
    "POST",
    { key, required: false, default: defaultValue },
    `${collectionId}.${key} (boolean)`
  );
  await waitForAttribute(collectionId, key);
}

async function ensureIndex(collectionId, key, attributes, type = "key") {
  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${collectionId}/indexes`,
    "POST",
    { key, type, attributes, orders: attributes.map(() => "ASC") },
    `índice ${collectionId}.${key} [${attributes.join(", ")}]`
  );
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

async function criarSchema() {
  console.log("\n== 1. Collection de tenants ==");
  await ensureCollection(COL.TENANTS, "Tenants (Ambientes Isolados)");
  await ensureStringAttribute(COL.TENANTS, "name", 255, { required: true });
  await ensureStringAttribute(COL.TENANTS, "owner_user_id", 64, { required: true });
  await ensureStringAttribute(COL.TENANTS, "team_id", 64);
  await ensureBooleanAttribute(COL.TENANTS, "is_active", true);
  await ensureIndex(COL.TENANTS, "ix_owner_user", ["owner_user_id"]);

  console.log("\n== 2. Atributos de tenancy nas collections operacionais ==");

  await ensureStringAttribute(COL.OPERATORS, "tenant_id", 64);
  await ensureStringAttribute(COL.OPERATORS, "created_by", 64);
  await ensureStringAttribute(COL.OPERATORS, "permissions", 64, { array: true });

  await ensureStringAttribute(COL.EVENTS, "tenant_id", 64);
  await ensureStringAttribute(COL.EVENTS, "owner_id", 64);
  await ensureStringAttribute(COL.EVENTS, "owner_name", 255);

  await ensureStringAttribute(COL.PARTICIPANTS, "tenant_id", 64);
  await ensureStringAttribute(COL.PARTICIPANTS, "owner_id", 64);

  await ensureStringAttribute(COL.AUDIT, "tenant_id", 64);
  await ensureStringAttribute(COL.AUDIT, "event_id", 64);
  await ensureStringAttribute(COL.AUDIT, "operator_id", 64);

  await ensureStringAttribute(COL.SETTINGS, "tenant_id", 64);

  console.log("\n== 3. Índices de performance por tenant ==");
  await ensureIndex(COL.OPERATORS, "ix_tenant", ["tenant_id"]);
  await ensureIndex(COL.OPERATORS, "ix_user_id", ["user_id"]);
  await ensureIndex(COL.EVENTS, "ix_tenant", ["tenant_id"]);
  await ensureIndex(COL.EVENTS, "ix_tenant_owner", ["tenant_id", "owner_id"]);
  await ensureIndex(COL.PARTICIPANTS, "ix_tenant", ["tenant_id"]);
  await ensureIndex(COL.PARTICIPANTS, "ix_tenant_event", ["tenant_id", "event_id"]);
  await ensureIndex(COL.AUDIT, "ix_tenant", ["tenant_id"]);
  await ensureIndex(COL.SETTINGS, "ix_tenant", ["tenant_id"]);
}

async function localizarUsuarioPorEmail(email) {
  const res = await request(`/users?${queryString([query.equal("email", email), query.limit(1)])}`);
  if (!res.users?.length) {
    throw new Error(`Usuário administrador ${email} não encontrado no Appwrite.`);
  }
  return res.users[0];
}

async function garantirTenantRaiz(adminUser) {
  console.log("\n== 4. Tenant raiz e Team de isolamento ==");

  const existentes = await listAllDocuments(COL.TENANTS, [query.equal("owner_user_id", adminUser.$id)]);
  let tenant = existentes[0] || null;

  const teamId = tenant?.team_id || `tenant_${adminUser.$id}`.slice(0, 36);

  await requestIdempotent(
    "/teams",
    "POST",
    { teamId, name: ROOT_TENANT_NAME },
    `team ${teamId}`
  );

  await requestIdempotent(
    `/teams/${teamId}/memberships`,
    "POST",
    { userId: adminUser.$id, roles: ["owner", "admin"] },
    `membership do admin ${adminUser.email}`
  );

  const docPermissions = [
    `read("team:${teamId}")`,
    `update("team:${teamId}")`,
    `delete("team:${teamId}")`
  ];

  if (!tenant) {
    tenant = await request(`/databases/${DATABASE_ID}/collections/${COL.TENANTS}/documents`, "POST", {
      documentId: "unique()",
      data: {
        name: ROOT_TENANT_NAME,
        owner_user_id: adminUser.$id,
        team_id: teamId,
        is_active: true
      },
      permissions: docPermissions
    });
    console.log(`  [+] tenant criado: ${tenant.$id}`);
  } else {
    tenant = await request(
      `/databases/${DATABASE_ID}/collections/${COL.TENANTS}/documents/${tenant.$id}`,
      "PATCH",
      { data: { team_id: teamId, is_active: true }, permissions: docPermissions }
    );
    console.log(`  [=] tenant existente: ${tenant.$id}`);
  }

  return { tenant, teamId, docPermissions };
}

async function backfill(tenant, teamId, docPermissions, adminUser) {
  console.log("\n== 5. Backfill dos dados existentes para o tenant raiz ==");

  const patch = async (collectionId, docId, data) =>
    request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${docId}`, "PATCH", {
      data,
      permissions: docPermissions
    });

  // 5.1 Operadores -----------------------------------------------------------
  const operadores = await listAllDocuments(COL.OPERATORS);
  for (const op of operadores) {
    const ehAdmin = op.role === "admin";
    await patch(COL.OPERATORS, op.$id, {
      tenant_id: tenant.$id,
      created_by: op.created_by || adminUser.$id,
      permissions:
        op.permissions?.length > 0
          ? op.permissions
          : ehAdmin
            ? ADMIN_PERMISSIONS
            : OPERATOR_PERMISSIONS
    });

    // Todo operador do tenant precisa pertencer ao Team para enxergar os dados.
    if (op.user_id) {
      await requestIdempotent(
        `/teams/${teamId}/memberships`,
        "POST",
        { userId: op.user_id, roles: ehAdmin ? ["admin"] : ["operador"] },
        `membership de ${op.email}`
      );
    }
  }
  console.log(`  [+] ${operadores.length} operador(es) vinculados ao tenant`);

  // 5.2 Eventos --------------------------------------------------------------
  const eventos = await listAllDocuments(COL.EVENTS);
  await pool(eventos, 10, (ev) =>
    patch(COL.EVENTS, ev.$id, {
      tenant_id: tenant.$id,
      owner_id: ev.owner_id || adminUser.$id,
      owner_name: ev.owner_name || adminUser.name
    })
  );
  console.log(`  [+] ${eventos.length} evento(s) migrados`);

  // 5.3 Participantes --------------------------------------------------------
  const participantes = await listAllDocuments(COL.PARTICIPANTS, [query.select(["$id", "event_id"])], 100);
  const resParticipantes = await pool(participantes, 25, (p) =>
    patch(COL.PARTICIPANTS, p.$id, { tenant_id: tenant.$id, owner_id: adminUser.$id })
  );
  console.log(
    `  [+] ${participantes.length - resParticipantes.failures.length}/${participantes.length} atleta(s) migrados`
  );
  if (resParticipantes.failures.length) {
    console.warn("  [!] falhas:", resParticipantes.failures.slice(0, 5));
  }

  // 5.4 Auditoria e configurações -------------------------------------------
  const auditorias = await listAllDocuments(COL.AUDIT, [query.select(["$id"])]);
  await pool(auditorias, 15, (a) => patch(COL.AUDIT, a.$id, { tenant_id: tenant.$id }));
  console.log(`  [+] ${auditorias.length} registro(s) de auditoria migrados`);

  const configuracoes = await listAllDocuments(COL.SETTINGS, [query.select(["$id"])]);
  await pool(configuracoes, 5, (s) => patch(COL.SETTINGS, s.$id, { tenant_id: tenant.$id }));
  console.log(`  [+] ${configuracoes.length} configuração(ões) migradas`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("=== PROVISIONAMENTO MULTI-TENANT CHIPOWER ===");

  await criarSchema();

  const adminUser = await localizarUsuarioPorEmail(ROOT_ADMIN_EMAIL);
  console.log(`\n  Administrador raiz: ${adminUser.name} <${adminUser.email}> (${adminUser.$id})`);

  const { tenant, teamId, docPermissions } = await garantirTenantRaiz(adminUser);
  await backfill(tenant, teamId, docPermissions, adminUser);

  console.log("\n=== CONCLUÍDO ===");
  console.log(`Tenant raiz: ${tenant.$id}`);
  console.log(`Team de isolamento: ${teamId}`);
  console.log("\nPróximo passo: node tools/infra/deploy_admin_function.mjs e depois tools/infra/harden_permissions.mjs");
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message, err.payload ? JSON.stringify(err.payload).slice(0, 400) : "");
  process.exit(1);
});

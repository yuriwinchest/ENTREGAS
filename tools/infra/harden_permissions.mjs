/**
 * Blindagem de permissões das collections.
 *
 * ESTADO ENCONTRADO: todas as collections estavam com `read/create/update/
 * delete("any")` e `documentSecurity: false`. Na prática, qualquer pessoa na
 * internet com o ID do projeto — que é público, vai no bundle do site — podia
 * ler, alterar e apagar a base inteira de atletas sem nunca fazer login.
 *
 * ESTADO APLICADO:
 *   - operacionais (events, participants, delivery_audit, event_settings):
 *       collection: apenas `create("users")`
 *       documento : read/update/delete do Team do tenant dono do registro
 *   - administrativas (operators, tenants):
 *       collection: nenhuma permissão — só a API key (Function) escreve
 *       documento : apenas leitura pelo Team do tenant
 *
 * Rode DEPOIS que o frontend novo estiver publicado, porque a versão antiga
 * grava documentos sem permissões e eles nasceriam invisíveis.
 *
 * Uso:
 *   APPWRITE_API_KEY="standard_..." node tools/infra/harden_permissions.mjs
 *   APPWRITE_API_KEY="..." node tools/infra/harden_permissions.mjs --verificar
 */

import { DATABASE_ID, request, listAllDocuments, pool, query } from "../lib/appwrite-admin.mjs";

const SOMENTE_VERIFICAR = process.argv.includes("--verificar");

const OPERACIONAIS = [
  { id: "participants", nome: "Participantes" },
  { id: "events", nome: "Eventos e Tabelas" },
  { id: "delivery_audit", nome: "Auditoria de Entregas" },
  { id: "event_settings", nome: "Configurações do Evento" }
];

const ADMINISTRATIVAS = [
  { id: "operators", nome: "Operadores" },
  { id: "tenants", nome: "Tenants (Ambientes Isolados)" }
];

const permissoesDeDocumento = (teamId) => [
  `read("team:${teamId}")`,
  `update("team:${teamId}")`,
  `delete("team:${teamId}")`
];

async function mapaDeTenants() {
  const tenants = await listAllDocuments("tenants");
  return new Map(tenants.map((t) => [t.$id, t.team_id]));
}

async function ajustarCollection({ id, nome }, permissoes) {
  const atual = await request(`/databases/${DATABASE_ID}/collections/${id}`);

  console.log(`\n  ${id}`);
  console.log(`    antes : documentSecurity=${atual.documentSecurity} perms=${JSON.stringify(atual.$permissions)}`);

  if (SOMENTE_VERIFICAR) return;

  await request(`/databases/${DATABASE_ID}/collections/${id}`, "PUT", {
    name: nome,
    permissions: permissoes,
    documentSecurity: true,
    enabled: true
  });

  console.log(`    depois: documentSecurity=true perms=${JSON.stringify(permissoes)}`);
}

/**
 * Adota documentos sem tenant_id.
 *
 * São registros criados pela versão anterior do site, que ainda não conhecia o
 * conceito de ambiente. Como hoje existe um único tenant, eles pertencem a ele
 * sem ambiguidade — e sem esta adoção sumiriam da tela após a blindagem.
 */
async function adotarOrfaos(collectionId, tenantId, teamId, ownerId) {
  const orfaos = (await listAllDocuments(collectionId, [query.select(["$id", "tenant_id"])])).filter(
    (d) => !d.tenant_id
  );

  if (orfaos.length === 0) return 0;
  if (SOMENTE_VERIFICAR) {
    console.log(`    ${collectionId}: ${orfaos.length} órfão(s) seriam adotados`);
    return orfaos.length;
  }

  const dadosExtras = collectionId === "events" ? { owner_id: ownerId } : {};

  const resultado = await pool(orfaos, 20, (doc) =>
    request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${doc.$id}`, "PATCH", {
      data: { tenant_id: tenantId, ...dadosExtras },
      permissions: permissoesDeDocumento(teamId)
    })
  );

  const ok = resultado.done - resultado.failures.length;
  console.log(`    ${collectionId}: ${ok}/${orfaos.length} órfão(s) adotados pelo tenant ${tenantId}`);
  return ok;
}

/** Garante que nenhum documento fique órfão de permissão após a blindagem. */
async function reforcarDocumentos(collectionId, tenants, somenteLeitura = false) {
  const docs = await listAllDocuments(collectionId, [query.select(["$id", "tenant_id"])]);

  const semTenant = docs.filter((d) => !d.tenant_id);
  const comTenant = docs.filter((d) => d.tenant_id && tenants.has(d.tenant_id));
  const tenantDesconhecido = docs.filter((d) => d.tenant_id && !tenants.has(d.tenant_id));

  console.log(
    `    ${collectionId}: ${docs.length} doc(s) | ${comTenant.length} com tenant válido | ` +
      `${semTenant.length} sem tenant | ${tenantDesconhecido.length} com tenant desconhecido`
  );

  if (semTenant.length > 0) {
    console.warn(
      `    [!] ${semTenant.length} documento(s) sem tenant_id ficarão inacessíveis: ` +
        semTenant.slice(0, 5).map((d) => d.$id).join(", ")
    );
  }

  if (SOMENTE_VERIFICAR) return;

  const resultado = await pool(comTenant, 20, (doc) => {
    const teamId = tenants.get(doc.tenant_id);
    const permissoes = somenteLeitura ? [`read("team:${teamId}")`] : permissoesDeDocumento(teamId);

    return request(
      `/databases/${DATABASE_ID}/collections/${collectionId}/documents/${doc.$id}`,
      "PATCH",
      { data: {}, permissions: permissoes }
    );
  });

  const ok = resultado.done - resultado.failures.length;
  console.log(`    permissões reaplicadas em ${ok}/${comTenant.length}`);
  if (resultado.failures.length) console.warn("    falhas:", resultado.failures.slice(0, 3));
}

async function desligarCadastroPublico() {
  console.log("\n== 3. Fechando o auto-cadastro anônimo do projeto ==");

  if (SOMENTE_VERIFICAR) return;

  // Sem isso, qualquer visitante cria a própria conta no projeto pela API
  // pública — a criação de acesso tem que passar pela Function de administração.
  for (const metodo of ["anonymous", "magic-url", "email-otp", "invites"]) {
    await request(`/projects/${process.env.APPWRITE_PROJECT_ID || "6a8238cc001997d3b0c8"}/auth/${metodo}`, "PATCH", {
      status: false
    })
      .then(() => console.log(`  [+] método de autenticação "${metodo}" desativado`))
      .catch((err) => console.warn(`  [!] não foi possível desativar "${metodo}": ${err.message}`));
  }

  await request(`/projects/${process.env.APPWRITE_PROJECT_ID || "6a8238cc001997d3b0c8"}/auth/limit`, "PATCH", {
    limit: 0
  }).catch(() => {});
}

async function main() {
  console.log(
    SOMENTE_VERIFICAR
      ? "=== VERIFICAÇÃO DE PERMISSÕES (nada será alterado) ==="
      : "=== BLINDAGEM DE PERMISSÕES ==="
  );

  const tenants = await mapaDeTenants();
  console.log(`\nTenants conhecidos: ${tenants.size}`);

  console.log("\n== 1. Collections operacionais ==");
  for (const col of OPERACIONAIS) {
    await ajustarCollection(col, ['create("users")']);
  }

  console.log("\n== 2. Collections administrativas (escrita só pela Function) ==");
  for (const col of ADMINISTRATIVAS) {
    await ajustarCollection(col, []);
  }

  // Antes de fechar as portas, ninguém pode ficar do lado de fora.
  if (tenants.size === 1) {
    const [tenantId, teamId] = [...tenants.entries()][0];
    const tenantDoc = await request(`/databases/${DATABASE_ID}/collections/tenants/documents/${tenantId}`);

    console.log("\n== Adoção de documentos legados (sem tenant) ==");
    for (const col of OPERACIONAIS) {
      await adotarOrfaos(col.id, tenantId, teamId, tenantDoc.owner_user_id);
    }
  } else {
    console.warn("\n[!] Mais de um tenant: os órfãos precisam ser atribuídos manualmente.");
  }

  console.log("\n== Reforço das permissões por documento ==");
  for (const col of OPERACIONAIS) {
    await reforcarDocumentos(col.id, tenants);
  }
  await reforcarDocumentos("operators", tenants, true);

  await desligarCadastroPublico();

  console.log("\n=== CONCLUÍDO ===");
  console.log("A base deixou de ser pública. Só sessões autenticadas do Team do tenant leem os dados.");
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});

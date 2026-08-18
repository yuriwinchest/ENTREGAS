/**
 * Cria a collection que registra cada planilha anexada a um evento.
 *
 * Por que existe: quando chegam mais inscritos, a planilha nova é somada ao
 * evento que já existe — e é isso que se quer, não uma tabela separada. Só que
 * sem registro nenhum, olhando a aba do evento não dá para saber que aquela
 * lista veio de dois ou três anexos diferentes. Esta collection guarda esse
 * histórico para a aba poder expandir e mostrar.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." node tools/infra/provision_import_batches.mjs
 */

import { DATABASE_ID, request, requestIdempotent, waitForAttribute } from "../lib/appwrite-admin.mjs";

const COLLECTION = "import_batches";

async function atributoTexto(key, size) {
  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${COLLECTION}/attributes/string`,
    "POST",
    { key, size, required: false, default: null, array: false },
    `${COLLECTION}.${key} (string ${size})`
  );
  await waitForAttribute(COLLECTION, key);
}

async function atributoInteiro(key) {
  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${COLLECTION}/attributes/integer`,
    "POST",
    { key, required: false, min: 0, max: 1000000, default: 0 },
    `${COLLECTION}.${key} (integer)`
  );
  await waitForAttribute(COLLECTION, key);
}

async function main() {
  console.log("=== HISTÓRICO DE PLANILHAS ANEXADAS ===\n");

  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections`,
    "POST",
    {
      collectionId: COLLECTION,
      name: "Planilhas Anexadas",
      permissions: ['create("users")'],
      documentSecurity: true,
      enabled: true
    },
    `collection ${COLLECTION}`
  );

  await atributoTexto("tenant_id", 64);
  await atributoTexto("event_id", 64);
  await atributoTexto("event_name", 255);
  await atributoTexto("file_name", 255);
  await atributoTexto("owner_id", 64);
  await atributoTexto("owner_name", 255);
  await atributoInteiro("inserted");
  await atributoInteiro("updated");
  await atributoInteiro("skipped");

  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${COLLECTION}/indexes`,
    "POST",
    { key: "ix_tenant_event", type: "key", attributes: ["tenant_id", "event_id"], orders: ["ASC", "ASC"] },
    "índice ix_tenant_event"
  );

  const col = await request(`/databases/${DATABASE_ID}/collections/${COLLECTION}`);
  console.log(`\nAtributos: ${col.attributes.map((a) => a.key).join(", ")}`);
  console.log("\n=== CONCLUÍDO ===");
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});

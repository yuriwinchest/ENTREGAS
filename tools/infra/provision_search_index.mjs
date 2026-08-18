/**
 * Cria os índices de busca textual dos atletas.
 *
 * Problema que isto resolve: a busca por nome usava `Query.contains`, que no
 * Appwrite exige índice do tipo `fulltext`. O índice existente (`ix_name`) é do
 * tipo `key`, então a consulta devolvia zero resultados para qualquer nome —
 * o operador digitava, nada aparecia, e o campo ficava girando.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." node tools/infra/provision_search_index.mjs
 */

import { DATABASE_ID, request, requestIdempotent } from "../lib/appwrite-admin.mjs";

const COLLECTION = "participants";

// Esta instância aceita apenas UM índice fulltext por collection, por isso a
// busca textual fica no campo `name`. Os demais são de igualdade exata.
const INDICES = [
  { key: "ft_name", type: "fulltext", attributes: ["name"] },
  { key: "ix_cpf", type: "key", attributes: ["cpf"] },
  { key: "ix_qr_code", type: "key", attributes: ["qr_code"] }
];

async function aguardarIndice(key, timeoutMs = 90000) {
  const limite = Date.now() + timeoutMs;

  while (Date.now() < limite) {
    const col = await request(`/databases/${DATABASE_ID}/collections/${COLLECTION}`);
    const indice = col.indexes.find((i) => i.key === key);

    if (!indice) return false;
    if (indice.status === "available") return true;
    if (indice.status === "failed") throw new Error(`Índice ${key} falhou: ${indice.error}`);

    await new Promise((r) => setTimeout(r, 1200));
  }

  throw new Error(`Timeout aguardando o índice ${key}`);
}

async function main() {
  console.log("=== ÍNDICES DE BUSCA DE ATLETAS ===\n");

  for (const indice of INDICES) {
    await requestIdempotent(
      `/databases/${DATABASE_ID}/collections/${COLLECTION}/indexes`,
      "POST",
      {
        key: indice.key,
        type: indice.type,
        attributes: indice.attributes,
        orders: indice.attributes.map(() => "ASC")
      },
      `${indice.key} (${indice.type}: ${indice.attributes.join(", ")})`
    );

    await aguardarIndice(indice.key);
  }

  const col = await request(`/databases/${DATABASE_ID}/collections/${COLLECTION}`);
  console.log("\nÍndices ativos em participants:");
  for (const i of col.indexes) {
    console.log(`  ${i.status === "available" ? "[ok]" : "[..]"} ${i.key} (${i.type}) -> ${i.attributes.join(", ")}`);
  }

  console.log("\n=== CONCLUÍDO ===");
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});

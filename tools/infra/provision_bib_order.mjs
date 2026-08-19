/**
 * Cria a coluna numérica usada para ordenar os atletas pelo número de peito.
 *
 * O problema: `bib_number` é texto, porque número de peito nem sempre é só
 * dígito (existe "12A", "E-45"). Ordenar texto no banco dá ordem alfabética —
 * 1, 10, 100, 101, 11 — e a lista fica impossível de conferir.
 *
 * A solução é uma coluna inteira paralela (`bib_order`), preenchida a partir
 * dos dígitos do número de peito, usada só para ordenar. O que aparece na tela
 * continua sendo o `bib_number` original.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." node tools/infra/provision_bib_order.mjs
 */

import {
  DATABASE_ID,
  request,
  requestIdempotent,
  waitForAttribute,
  listAllDocuments,
  pool,
  query
} from "../lib/appwrite-admin.mjs";

const COLLECTION = "participants";

/** Mesma regra usada pelo aplicativo ao importar. */
export function calcularOrdem(bibNumber) {
  const digitos = String(bibNumber ?? "").replace(/\D/g, "");
  if (!digitos) return 0;

  const valor = parseInt(digitos.slice(0, 9), 10);
  return Number.isFinite(valor) ? valor : 0;
}

async function main() {
  console.log("=== ORDENAÇÃO NUMÉRICA POR NÚMERO DE PEITO ===\n");

  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${COLLECTION}/attributes/integer`,
    "POST",
    { key: "bib_order", required: false, min: 0, max: 999999999, default: 0 },
    `${COLLECTION}.bib_order (integer)`
  );
  await waitForAttribute(COLLECTION, "bib_order");

  await requestIdempotent(
    `/databases/${DATABASE_ID}/collections/${COLLECTION}/indexes`,
    "POST",
    {
      key: "ix_tenant_event_bib",
      type: "key",
      attributes: ["tenant_id", "event_id", "bib_order"],
      orders: ["ASC", "ASC", "ASC"]
    },
    "índice ix_tenant_event_bib"
  );

  console.log("\nPreenchendo a ordem dos atletas já cadastrados...");
  const atletas = await listAllDocuments(COLLECTION, [query.select(["$id", "bib_number", "bib_order"])], 100);

  const pendentes = atletas.filter((a) => {
    const esperado = calcularOrdem(a.bib_number);
    return esperado !== 0 && a.bib_order !== esperado;
  });

  console.log(`  ${atletas.length} atleta(s) na base, ${pendentes.length} precisam de atualização`);

  if (pendentes.length > 0) {
    const resultado = await pool(pendentes, 25, (a) =>
      request(`/databases/${DATABASE_ID}/collections/${COLLECTION}/documents/${a.$id}`, "PATCH", {
        data: { bib_order: calcularOrdem(a.bib_number) }
      })
    );

    const ok = resultado.done - resultado.failures.length;
    console.log(`  ${ok}/${pendentes.length} atualizados`);
    if (resultado.failures.length) console.warn("  falhas:", resultado.failures.slice(0, 3));
  }

  // Conferência: os dez primeiros devem sair em ordem numérica de verdade.
  const amostra = await request(
    `/databases/${DATABASE_ID}/collections/${COLLECTION}/documents?` +
      [
        JSON.stringify({ method: "orderAsc", attribute: "bib_order" }),
        JSON.stringify({ method: "limit", values: [10] })
      ]
        .map((q) => `queries[]=${encodeURIComponent(q)}`)
        .join("&")
  );

  console.log(`\n  ordem agora: ${amostra.documents.map((d) => "#" + d.bib_number).join(", ")}`);
  console.log("\n=== CONCLUÍDO ===");
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});

/**
 * Mede a concorrência ideal para exclusão e atualização documento a documento.
 *
 * Necessário porque a exclusão em lote do Appwrite ignora o filtro (ver
 * probe_bulk_semantics.mjs) e por isso está proibida no código da aplicação:
 * apagar "os atletas deste evento" precisa ser feito por ID, um a um.
 *
 * Roda inteiramente numa collection descartável.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." node tools/infra/probe_delete_perf.mjs
 */

import { DATABASE_ID, request } from "../lib/appwrite-admin.mjs";

const SANDBOX = "sandbox_delete_perf";
const AMOSTRA = 400;

const q = (obj) => `queries[]=${encodeURIComponent(JSON.stringify(obj))}`;

async function criarSandbox() {
  await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});
  await request(`/databases/${DATABASE_ID}/collections`, "POST", {
    collectionId: SANDBOX,
    name: "Sandbox de Desempenho (descartável)",
    permissions: [],
    documentSecurity: false
  });

  await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/attributes/string`, "POST", {
    key: "nome",
    size: 128,
    required: false,
    default: null,
    array: false
  });

  for (let i = 0; i < 40; i++) {
    const col = await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`);
    if (col.attributes.every((a) => a.status === "available")) return;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Atributos do sandbox não ficaram prontos.");
}

async function semear(prefixo, quantidade) {
  const ids = [];
  for (let inicio = 0; inicio < quantidade; inicio += 100) {
    const fatia = Math.min(100, quantidade - inicio);
    const documentos = Array.from({ length: fatia }, (_, i) => ({
      $id: `${prefixo}${String(inicio + i).padStart(5, "0")}`,
      nome: `REGISTRO ${inicio + i}`
    }));
    ids.push(...documentos.map((d) => d.$id));
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "POST", { documents: documentos });
  }
  return ids;
}

async function executarComConcorrencia(ids, concorrencia, trabalho) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concorrencia }, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        await trabalho(id).catch(() => {});
      }
    })
  );
}

async function main() {
  console.log("=== DESEMPENHO DE EXCLUSÃO (collection descartável) ===\n");
  await criarSandbox();

  try {
    console.log(`Amostra: ${AMOSTRA} documentos por rodada\n`);

    for (const concorrencia of [25, 50, 75, 100]) {
      const ids = await semear(`c${concorrencia}x`, AMOSTRA);

      const inicio = Date.now();
      await executarComConcorrencia(ids, concorrencia, (id) =>
        request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents/${id}`, "DELETE")
      );
      const duracao = Date.now() - inicio;

      const restantes = (
        await request(
          `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({ method: "limit", values: [1] })}`
        )
      ).total;

      console.log(
        `  concorrência ${String(concorrencia).padStart(3)}: ${String(duracao).padStart(6)}ms ` +
          `(${(AMOSTRA / (duracao / 1000)).toFixed(0)} doc/s) — restaram ${restantes}`
      );
    }

    console.log("\n=== LEITURA DOS IDS (quantos por página) ===");
    await semear("leitura", AMOSTRA);
    for (const limite of [100, 500, 1000]) {
      const inicio = Date.now();
      const r = await request(
        `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({
          method: "limit",
          values: [limite]
        })}&${q({ method: "select", values: ["$id"] })}`
      );
      console.log(`  limit=${String(limite).padStart(4)}: ${r.documents.length} ids em ${Date.now() - inicio}ms`);
    }
  } finally {
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});
    console.log(`\nSandbox destruído.`);
  }
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});
  process.exit(1);
});

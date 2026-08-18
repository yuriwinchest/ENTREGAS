/**
 * Hipótese: as escritas em lote do Appwrite não leem `queries` da query string,
 * só do CORPO da requisição. Se for isso, o filtro nunca chegou ao servidor e
 * a operação caiu no caminho "sem filtro" — que apaga a collection inteira.
 *
 * Este script testa as duas formas, lado a lado, numa collection descartável.
 * O resultado decide se a exclusão em lote pode ou não voltar a ser usada.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." node tools/infra/probe_bulk_queries_body.mjs
 */

import { DATABASE_ID, request } from "../lib/appwrite-admin.mjs";

const SANDBOX = "sandbox_queries_body";

const q = (obj) => `queries[]=${encodeURIComponent(JSON.stringify(obj))}`;

const contar = async (filtro) => {
  const extra = filtro ? `&${q(filtro)}` : "";
  const r = await request(
    `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({ method: "limit", values: [1] })}${extra}`
  );
  return r.total;
};

async function criarSandbox() {
  await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});
  await request(`/databases/${DATABASE_ID}/collections`, "POST", {
    collectionId: SANDBOX,
    name: "Sandbox de Queries (descartável)",
    permissions: [],
    documentSecurity: false
  });

  await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/attributes/string`, "POST", {
    key: "grupo",
    size: 32,
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

async function semear(grupo, quantidade, prefixo) {
  for (let inicio = 0; inicio < quantidade; inicio += 100) {
    const fatia = Math.min(100, quantidade - inicio);
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "POST", {
      documents: Array.from({ length: fatia }, (_, i) => ({
        $id: `${prefixo}${String(inicio + i).padStart(4, "0")}`,
        grupo
      }))
    });
  }
}

async function limparTudo() {
  await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE").catch(() => {});
}

async function main() {
  console.log("=== FILTRO NA QUERY STRING x NO CORPO (collection descartável) ===\n");
  await criarSandbox();

  const filtroB = { method: "equal", attribute: "grupo", values: ["B"] };

  try {
    // ---- Forma 1: filtro na query string (a que causou o incidente) --------
    await limparTudo();
    await semear("A", 100, "a");
    await semear("B", 30, "b");
    console.log(`1. Filtro na QUERY STRING — antes: ${await contar()} documentos (100 A + 30 B)`);

    const inicio1 = Date.now();
    const r1 = await request(
      `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q(filtroB)}`,
      "DELETE"
    );
    const sobrou1 = await contar();
    console.log(
      `   removidos=${r1.total} restaram=${sobrou1} em ${Date.now() - inicio1}ms ` +
        `-> ${sobrou1 === 100 ? "FILTRO RESPEITADO" : "FILTRO IGNOROU E APAGOU TUDO"}`
    );

    // ---- Forma 2: filtro no CORPO da requisição ---------------------------
    await limparTudo();
    await semear("A", 100, "a");
    await semear("B", 30, "b");
    console.log(`\n2. Filtro no CORPO — antes: ${await contar()} documentos (100 A + 30 B)`);

    const inicio2 = Date.now();
    const r2 = await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE", {
      queries: [JSON.stringify(filtroB)]
    });
    const sobrou2 = await contar();
    const duracao2 = Date.now() - inicio2;
    console.log(
      `   removidos=${r2.total} restaram=${sobrou2} em ${duracao2}ms ` +
        `-> ${sobrou2 === 100 ? "FILTRO RESPEITADO" : "FILTRO IGNOROU E APAGOU TUDO"}`
    );

    // ---- Forma 2 aplicada à ATUALIZAÇÃO em lote ---------------------------
    await limparTudo();
    await semear("A", 100, "a");
    await semear("B", 30, "b");
    console.log(`\n3. Atualização em lote com filtro no CORPO`);

    const inicio3 = Date.now();
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "PATCH", {
      queries: [JSON.stringify(filtroB)],
      data: { grupo: "ALTERADO" }
    });
    const alterados = await contar({ method: "equal", attribute: "grupo", values: ["ALTERADO"] });
    const intactos = await contar({ method: "equal", attribute: "grupo", values: ["A"] });
    console.log(
      `   alterados=${alterados} intactos(A)=${intactos} em ${Date.now() - inicio3}ms ` +
        `-> ${alterados === 30 && intactos === 100 ? "FILTRO RESPEITADO" : "FILTRO IGNORADO"}`
    );

    // ---- Desempenho da exclusão filtrada em volume ------------------------
    await limparTudo();
    await semear("A", 100, "a");
    await semear("B", 400, "b");
    console.log(`\n4. Desempenho: excluir 400 de 500 com filtro no corpo`);

    const inicio4 = Date.now();
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE", {
      queries: [JSON.stringify(filtroB)]
    });
    const duracao4 = Date.now() - inicio4;
    const sobrou4 = await contar();
    console.log(
      `   ${duracao4}ms, restaram ${sobrou4} ` +
        `-> ${sobrou4 === 100 ? `OK (${(400 / (duracao4 / 1000)).toFixed(0)} doc/s)` : "INSEGURO"}`
    );
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

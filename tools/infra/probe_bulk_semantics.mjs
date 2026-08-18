/**
 * Sonda o comportamento real das operações em lote do Appwrite.
 *
 * TUDO acontece numa collection descartável criada e destruída pelo próprio
 * script. Nenhuma linha aqui toca em `participants`, `events` ou qualquer
 * dado real — e nenhuma sonda destrutiva deve ser escrita de outro jeito.
 *
 * A pergunta que este script responde: o filtro por query é respeitado nas
 * escritas em lote? Se não for, exclusão em lote por filtro está proibida no
 * código da aplicação.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." node tools/infra/probe_bulk_semantics.mjs
 */

import { DATABASE_ID, request } from "../lib/appwrite-admin.mjs";

const SANDBOX = "sandbox_bulk_descartavel";

let falhas = 0;
const checar = (descricao, condicao, extra = "") => {
  console.log(`  ${condicao ? "OK    " : "ATENÇÃO"} ${descricao}${extra ? ` — ${extra}` : ""}`);
  if (!condicao) falhas++;
};

const q = (obj) => `queries[]=${encodeURIComponent(JSON.stringify(obj))}`;

const contar = async () => {
  const r = await request(
    `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({ method: "limit", values: [1] })}`
  );
  return r.total;
};

async function criarSandbox() {
  await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});

  await request(`/databases/${DATABASE_ID}/collections`, "POST", {
    collectionId: SANDBOX,
    name: "Sandbox de Sondagem (descartável)",
    permissions: [],
    documentSecurity: false
  });

  for (const [key, size] of [["grupo", 32], ["nome", 128]]) {
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/attributes/string`, "POST", {
      key,
      size,
      required: false,
      default: null,
      array: false
    });
  }

  // Espera os atributos ficarem disponíveis antes de gravar.
  for (let i = 0; i < 40; i++) {
    const col = await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`);
    if (col.attributes.every((a) => a.status === "available")) return;
    await new Promise((r) => setTimeout(r, 800));
  }

  throw new Error("Atributos do sandbox não ficaram prontos.");
}

/** O Appwrite aceita no máximo 100 documentos por requisição em lote. */
const TAMANHO_DO_LOTE = 100;

async function semear(grupo, quantidade, prefixo) {
  for (let inicio = 0; inicio < quantidade; inicio += TAMANHO_DO_LOTE) {
    const fatia = Math.min(TAMANHO_DO_LOTE, quantidade - inicio);
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "POST", {
      documents: Array.from({ length: fatia }, (_, i) => ({
        $id: `${prefixo}${String(inicio + i).padStart(4, "0")}`,
        grupo,
        nome: `REGISTRO ${grupo} ${inicio + i}`
      }))
    });
  }
}

async function main() {
  console.log("=== SONDAGEM DE OPERAÇÕES EM LOTE (collection descartável) ===\n");

  await criarSandbox();
  console.log(`Sandbox "${SANDBOX}" criado.\n`);

  try {
    console.log("1. Criação em lote");
    const inicioCriacao = Date.now();
    await semear("A", 300, "a");
    const duracao = Date.now() - inicioCriacao;
    checar("300 documentos em 3 requisições", (await contar()) === 300, `${duracao}ms`);

    console.log("\n2. Filtro é respeitado na EXCLUSÃO em lote?");
    await semear("B", 50, "b");
    const antes = await contar();
    checar("sandbox com 350 documentos", antes === 350, String(antes));

    const removidos = await request(
      `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({
        method: "equal",
        attribute: "grupo",
        values: ["B"]
      })}`,
      "DELETE"
    );

    const depois = await contar();
    const filtroRespeitado = depois === 300;

    checar(
      "exclusão em lote respeitou o filtro (esperado: sobrar 300)",
      filtroRespeitado,
      `removidos=${removidos.total} restaram=${depois}`
    );

    if (!filtroRespeitado) {
      console.log("\n  >>> CONFIRMADO: o filtro é IGNORADO e a collection inteira é apagada.");
      console.log("  >>> Exclusão em lote por filtro fica PROIBIDA no código da aplicação.");
    }

    console.log("\n3. Filtro é respeitado na ATUALIZAÇÃO em lote?");
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE").catch(() => {});
    await semear("A", 100, "c");
    await semear("B", 20, "d");

    await request(
      `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({
        method: "equal",
        attribute: "grupo",
        values: ["B"]
      })}`,
      "PATCH",
      { data: { nome: "ALTERADO" } }
    );

    const alterados = await request(
      `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({
        method: "equal",
        attribute: "nome",
        values: ["ALTERADO"]
      })}&${q({ method: "limit", values: [1] })}`
    );

    checar(
      "atualização em lote respeitou o filtro (esperado: 20)",
      alterados.total === 20,
      `alterados=${alterados.total}`
    );

    console.log("\n4. Exclusão em lote por lista explícita de IDs");
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE").catch(() => {});
    await semear("A", 60, "e");

    const ids = ["e0000", "e0001", "e0002"];
    await request(
      `/databases/${DATABASE_ID}/collections/${SANDBOX}/documents?${q({
        method: "equal",
        attribute: "$id",
        values: ids
      })}`,
      "DELETE"
    );

    const restantes = await contar();
    checar(
      "exclusão por lista de IDs respeitou o filtro (esperado: 57)",
      restantes === 57,
      `restaram=${restantes}`
    );

    console.log("\n5. Limite de tamanho do lote de criação");
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE").catch(() => {});
    for (const tamanho of [500, 1000, 1500]) {
      try {
        await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "POST", {
          documents: Array.from({ length: tamanho }, (_, i) => ({
            $id: `t${tamanho}x${String(i).padStart(5, "0")}`,
            grupo: "T",
            nome: `T ${i}`
          }))
        });
        console.log(`  OK     lote de ${tamanho} aceito`);
        await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}/documents`, "DELETE").catch(() => {});
      } catch (err) {
        console.log(`  LIMITE lote de ${tamanho} recusado — ${err.message.slice(0, 110)}`);
      }
    }
  } finally {
    await request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});
    console.log(`\nSandbox "${SANDBOX}" destruído.`);
  }

  console.log(`\n=== ${falhas} comportamento(s) fora do esperado ===`);
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  request(`/databases/${DATABASE_ID}/collections/${SANDBOX}`, "DELETE").catch(() => {});
  process.exit(1);
});

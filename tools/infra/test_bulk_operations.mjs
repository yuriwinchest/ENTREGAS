/**
 * Teste das operações em massa com GRUPO DE CONTROLE.
 *
 * A pergunta que este teste responde é uma só: quando eu mando apagar os
 * atletas do evento X, alguma coisa fora do evento X é afetada?
 *
 * Para isso ele cria DOIS eventos descartáveis — um alvo e um controle — e
 * confere o controle intacto depois de cada operação destrutiva. Se o filtro
 * vazar de novo, este teste falha antes de qualquer dado real ser tocado.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." ADMIN_PASSWORD="..." node tools/infra/test_bulk_operations.mjs
 */

import { ENDPOINT, PROJECT_ID, DATABASE_ID, request } from "../lib/appwrite-admin.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alinepedrosa001@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ATLETAS_ALVO = 500;
const ATLETAS_CONTROLE = 40;

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

const q = (obj) => `queries[]=${encodeURIComponent(JSON.stringify(obj))}`;

async function autenticar() {
  const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: base,
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const corpo = await res.json();
  if (!res.ok) throw new Error(corpo.message);

  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const jwtRes = await fetch(`${ENDPOINT}/account/jwts`, { method: "POST", headers: { ...base, Cookie: cookie } });
  const jwtBody = await jwtRes.json();
  if (!jwtRes.ok) throw new Error(jwtBody.message);

  return jwtBody.jwt;
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

const contarDoEvento = async (eventId) => {
  const r = await request(
    `/databases/${DATABASE_ID}/collections/participants/documents?${q({
      method: "equal",
      attribute: "event_id",
      values: [eventId]
    })}&${q({ method: "limit", values: [1] })}`
  );
  return r.total;
};

const contarTudo = async () => {
  const r = await request(
    `/databases/${DATABASE_ID}/collections/participants/documents?${q({ method: "limit", values: [1] })}`
  );
  return r.total;
};

async function criarEvento(nome, tenantId, teamId, ownerId) {
  return request(`/databases/${DATABASE_ID}/collections/events/documents`, "POST", {
    documentId: "unique()",
    data: {
      name: nome,
      event_date: "18/08/2026",
      is_active: true,
      tenant_id: tenantId,
      owner_id: ownerId,
      owner_name: "Teste Automatizado"
    },
    permissions: [`read("team:${teamId}")`, `update("team:${teamId}")`, `delete("team:${teamId}")`]
  });
}

async function semearAtletas(evento, quantidade, tenantId, teamId, ownerId, prefixo) {
  const permissoes = [`read("team:${teamId}")`, `update("team:${teamId}")`, `delete("team:${teamId}")`];
  const inicio = Date.now();
  let requisicoes = 0;

  for (let i = 0; i < quantidade; i += 100) {
    const fatia = Math.min(100, quantidade - i);
    requisicoes++;
    await request(`/databases/${DATABASE_ID}/collections/participants/documents`, "POST", {
      documents: Array.from({ length: fatia }, (_, j) => ({
        $id: `${prefixo}${String(i + j).padStart(5, "0")}`,
        $permissions: permissoes,
        bib_number: `${i + j}`,
        chip: `${prefixo.toUpperCase()}${i + j}`,
        name: `ATLETA DE TESTE ${i + j}`,
        name_folded: `ATLETA DE TESTE ${i + j}`,
        qr_code: `${i + j}`,
        event_id: evento.$id,
        event_name: evento.name,
        tenant_id: tenantId,
        owner_id: ownerId,
        delivered_at: i + j < 10 ? new Date().toISOString() : null,
        receiver_name: i + j < 10 ? `ATLETA DE TESTE ${i + j}` : null
      }))
    });
  }

  return { duracao: Date.now() - inicio, requisicoes };
}

async function removerEvento(eventId) {
  for (;;) {
    const r = await request(
      `/databases/${DATABASE_ID}/collections/participants/documents?${q({
        method: "equal",
        attribute: "event_id",
        values: [eventId]
      })}&${q({ method: "limit", values: [100] })}&${q({ method: "select", values: ["$id"] })}`
    );
    if (r.documents.length === 0) break;
    for (const d of r.documents) {
      await request(`/databases/${DATABASE_ID}/collections/participants/documents/${d.$id}`, "DELETE").catch(
        () => {}
      );
    }
  }
  await request(`/databases/${DATABASE_ID}/collections/events/documents/${eventId}`, "DELETE").catch(() => {});
}

async function main() {
  console.log("=== TESTE DE OPERAÇÕES EM MASSA (com grupo de controle) ===\n");

  const jwt = await autenticar();
  const boot = await chamar(jwt, { action: "bootstrap" });
  const tenantId = boot.corpo.tenant.id;
  const teamId = boot.corpo.tenant.team_id;
  const ownerId = boot.corpo.user.id;

  const totalAntesDeTudo = await contarTudo();
  console.log(`Base antes do teste: ${totalAntesDeTudo} atleta(s)\n`);

  const alvo = await criarEvento("ZZ TESTE ALVO (descartável)", tenantId, teamId, ownerId);
  const controle = await criarEvento("ZZ TESTE CONTROLE (descartável)", tenantId, teamId, ownerId);

  try {
    console.log("1. Importação em lote");
    const semeadura = await semearAtletas(alvo, ATLETAS_ALVO, tenantId, teamId, ownerId, "alvo");
    await semearAtletas(controle, ATLETAS_CONTROLE, tenantId, teamId, ownerId, "ctrl");

    checar(
      `${ATLETAS_ALVO} atletas gravados em ${semeadura.requisicoes} requisição(ões)`,
      (await contarDoEvento(alvo.$id)) === ATLETAS_ALVO,
      `${semeadura.duracao}ms — ${(ATLETAS_ALVO / (semeadura.duracao / 1000)).toFixed(0)} atletas/s`
    );
    checar(`controle com ${ATLETAS_CONTROLE} atletas`, (await contarDoEvento(controle.$id)) === ATLETAS_CONTROLE);

    console.log("\n2. Reset de entregas do evento alvo");
    const inicioReset = Date.now();
    const reset = await chamar(jwt, { action: "resetDeliveries", eventId: alvo.$id });
    checar("reset responde 200", reset.status === 200, `${Date.now() - inicioReset}ms`);
    checar("10 entregas resetadas no alvo", reset.corpo.reset === 10, `reset=${reset.corpo.reset}`);
    checar(
      "CONTROLE intacto após o reset",
      (await contarDoEvento(controle.$id)) === ATLETAS_CONTROLE,
      `${await contarDoEvento(controle.$id)} atletas`
    );

    console.log("\n3. Exclusão em massa do evento alvo");
    const inicioPurge = Date.now();
    const purge = await chamar(jwt, { action: "purgeParticipants", eventId: alvo.$id });
    const duracaoPurge = Date.now() - inicioPurge;

    checar("exclusão responde 200", purge.status === 200, purge.corpo?.message || "");
    checar(
      `${ATLETAS_ALVO} atletas excluídos`,
      purge.corpo.deleted === ATLETAS_ALVO,
      `${duracaoPurge}ms — ${(ATLETAS_ALVO / (duracaoPurge / 1000)).toFixed(0)} atletas/s`
    );
    checar("evento alvo zerado", (await contarDoEvento(alvo.$id)) === 0);

    const controleDepois = await contarDoEvento(controle.$id);
    checar(
      ">>> CONTROLE INTACTO — o filtro NÃO vazou <<<",
      controleDepois === ATLETAS_CONTROLE,
      `${controleDepois}/${ATLETAS_CONTROLE}`
    );

    console.log("\n4. Exclusão de evento inteiro (controle)");
    const delEvento = await chamar(jwt, { action: "deleteEvent", eventId: controle.$id });
    checar("exclusão do evento responde 200", delEvento.status === 200, delEvento.corpo?.message || "");
    checar(
      `${ATLETAS_CONTROLE} atletas do evento removidos junto`,
      delEvento.corpo.athletesDeleted === ATLETAS_CONTROLE
    );

    console.log("\n5. Isolamento: evento de outro tenant é recusado");
    const forjado = await chamar(jwt, { action: "purgeParticipants", eventId: "evento_inexistente_123" });
    checar("evento inexistente recusado", forjado.status === 404 || forjado.status === 403, forjado.corpo?.message || "");
  } finally {
    console.log("\n6. Limpeza");
    await removerEvento(alvo.$id);
    await removerEvento(controle.$id);

    const totalFinal = await contarTudo();
    checar(
      "base voltou ao estado inicial",
      totalFinal === totalAntesDeTudo,
      `${totalFinal} (antes: ${totalAntesDeTudo})`
    );
  }

  console.log(`\n=== ${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} TESTE(S) FALHARAM`} ===`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});

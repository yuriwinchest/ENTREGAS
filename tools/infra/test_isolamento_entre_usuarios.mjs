/**
 * Responde a duas perguntas de forma honesta, com evidência:
 *
 *   1. Anexar uma planilha nova a um evento JÁ EXISTENTE complementa a lista
 *      (soma) ou substitui/duplica?
 *
 *   2. Um operador consegue LER os dados de uma tabela que outro operador
 *      anexou? Não pela tela — pela API, que é o que importa de verdade.
 *
 * Usa um operador descartável e eventos descartáveis, e limpa tudo no final.
 * Nada de destrutivo encosta em dado real.
 *
 * Uso:
 *   APPWRITE_API_KEY="..." ADMIN_PASSWORD="..." node tools/infra/test_isolamento_entre_usuarios.mjs
 */

import { ENDPOINT, PROJECT_ID, DATABASE_ID, request } from "../lib/appwrite-admin.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alinepedrosa001@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const OPERADOR_EMAIL = "teste.isolamento.chipower@exemplo.com";
const OPERADOR_SENHA = "Isolamento@2026";

if (!ADMIN_PASSWORD) {
  console.error('Defina ADMIN_PASSWORD="..." para rodar o teste.');
  process.exit(1);
}

const base = { "X-Appwrite-Project": PROJECT_ID, "Content-Type": "application/json" };
const q = (o) => `queries[]=${encodeURIComponent(JSON.stringify(o))}`;

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
  if (!res.ok) throw new Error(`${email}: ${corpo.message}`);

  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const jwtRes = await fetch(`${ENDPOINT}/account/jwts`, { method: "POST", headers: { ...base, Cookie: cookie } });
  const jwtBody = await jwtRes.json();
  if (!jwtRes.ok) throw new Error(`${email} jwt: ${jwtBody.message}`);

  return { cookie, jwt: jwtBody.jwt };
}

/** Consulta feita COM A SESSÃO DO USUÁRIO — sem API key, como o navegador faz. */
async function consultarComoUsuario(sessao, collection, filtros) {
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${collection}/documents?${filtros
    .map(q)
    .join("&")}`;
  const res = await fetch(url, { headers: { ...base, Cookie: sessao.cookie } });
  const corpo = await res.json();
  if (!res.ok) return { erro: corpo.message, total: -1, documents: [] };
  return corpo;
}

async function chamarFunction(jwt, payload) {
  const exec = await request("/functions/admin-api/executions", "POST", {
    body: JSON.stringify({ ...payload, jwt }),
    async: false,
    path: "/",
    method: "POST"
  });
  try {
    return { status: exec.responseStatusCode, corpo: JSON.parse(exec.responseBody || "{}") };
  } catch {
    return { status: exec.responseStatusCode, corpo: {} };
  }
}

async function criarEvento(nome, tenantId, teamId, ownerId, ownerNome) {
  return request(`/databases/${DATABASE_ID}/collections/events/documents`, "POST", {
    documentId: "unique()",
    data: { name: nome, is_active: true, tenant_id: tenantId, owner_id: ownerId, owner_name: ownerNome },
    permissions: [`read("team:${teamId}")`, `update("team:${teamId}")`, `delete("team:${teamId}")`]
  });
}

async function anexarAtletas(evento, quantidade, tenantId, teamId, ownerId, prefixo, inicioBib = 0) {
  const permissoes = [`read("team:${teamId}")`, `update("team:${teamId}")`, `delete("team:${teamId}")`];
  for (let i = 0; i < quantidade; i += 100) {
    const fatia = Math.min(100, quantidade - i);
    await request(`/databases/${DATABASE_ID}/collections/participants/documents`, "POST", {
      documents: Array.from({ length: fatia }, (_, j) => {
        const n = inicioBib + i + j;
        return {
          $id: `${prefixo}${String(n).padStart(5, "0")}`,
          $permissions: permissoes,
          bib_number: `${n}`,
          chip: `${prefixo.toUpperCase()}${n}`,
          name: `ATLETA ${n}`,
          name_folded: `ATLETA ${n}`,
          qr_code: `${n}`,
          event_id: evento.$id,
          event_name: evento.name,
          tenant_id: tenantId,
          owner_id: ownerId,
          delivered_at: null,
          receiver_name: null
        };
      })
    });
  }
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

async function limpar(eventos, operatorId, jwtAdmin) {
  for (const ev of eventos) {
    if (!ev) continue;
    for (;;) {
      const r = await request(
        `/databases/${DATABASE_ID}/collections/participants/documents?${q({
          method: "equal",
          attribute: "event_id",
          values: [ev.$id]
        })}&${q({ method: "limit", values: [100] })}&${q({ method: "select", values: ["$id"] })}`
      );
      if (r.documents.length === 0) break;
      for (const d of r.documents) {
        await request(`/databases/${DATABASE_ID}/collections/participants/documents/${d.$id}`, "DELETE").catch(
          () => {}
        );
      }
    }
    await request(`/databases/${DATABASE_ID}/collections/events/documents/${ev.$id}`, "DELETE").catch(() => {});
  }

  if (operatorId) await chamarFunction(jwtAdmin, { action: "deleteOperator", operatorId }).catch(() => {});

  const usuarios = await request(
    `/users?${q({ method: "equal", attribute: "email", values: [OPERADOR_EMAIL] })}`
  ).catch(() => ({ users: [] }));
  for (const u of usuarios.users || []) {
    await request(`/users/${u.$id}`, "DELETE").catch(() => {});
  }
}

async function main() {
  console.log("=== TESTE: COMPLEMENTAR EVENTO E ISOLAMENTO ENTRE USUÁRIOS ===\n");

  const admin = await autenticar(ADMIN_EMAIL, ADMIN_PASSWORD);
  const boot = await chamarFunction(admin.jwt, { action: "bootstrap" });
  const tenantId = boot.corpo.tenant.id;
  const teamId = boot.corpo.tenant.team_id;
  const adminId = boot.corpo.user.id;

  let eventoAdmin = null;
  let eventoOperador = null;
  let operatorId = null;

  try {
    console.log("PERGUNTA 1: anexar planilha nova a um evento existente complementa?");
    eventoAdmin = await criarEvento("ZZ TESTE COMPLEMENTO", tenantId, teamId, adminId, "Aline");

    await anexarAtletas(eventoAdmin, 800, tenantId, teamId, adminId, "lote1", 1);
    const apos800 = await contarDoEvento(eventoAdmin.$id);
    checar("primeira planilha: 800 atletas", apos800 === 800, String(apos800));

    await anexarAtletas(eventoAdmin, 200, tenantId, teamId, adminId, "lote2", 801);
    const apos1000 = await contarDoEvento(eventoAdmin.$id);
    checar("segunda planilha de 200 SOMOU ao evento", apos1000 === 1000, `${apos1000} atletas`);

    // Reimportar os MESMOS números de peito: o sistema duplica?
    await anexarAtletas(eventoAdmin, 50, tenantId, teamId, adminId, "lote3", 1);
    const aposRepetidos = await contarDoEvento(eventoAdmin.$id);
    const duplicou = aposRepetidos > 1000;
    checar(
      "reimportar os mesmos 50 números NÃO duplica",
      !duplicou,
      duplicou ? `virou ${aposRepetidos} — DUPLICOU 50 atletas` : String(aposRepetidos)
    );

    console.log("\nPERGUNTA 2: um operador enxerga a tabela que outro anexou?");

    const criacao = await chamarFunction(admin.jwt, {
      action: "createOperator",
      name: "Operador Isolamento",
      email: OPERADOR_EMAIL,
      password: OPERADOR_SENHA,
      role: "operador",
      permissions: ["tab.desk", "tab.participants", "athlete.import", "delivery.confirm"]
    });
    operatorId = criacao.corpo.operator?.$id;
    const operadorUserId = criacao.corpo.operator?.user_id;
    checar("operador criado SEM 'ver tabelas de toda a equipe'", criacao.status === 200);

    eventoOperador = await criarEvento(
      "ZZ TABELA DO OPERADOR",
      tenantId,
      teamId,
      operadorUserId,
      "Operador Isolamento"
    );
    await anexarAtletas(eventoOperador, 30, tenantId, teamId, operadorUserId, "oper", 5000);

    const sessaoOperador = await autenticar(OPERADOR_EMAIL, OPERADOR_SENHA);

    // (a) O que a TELA mostra: a listagem já filtra por dono
    const naTela = await consultarComoUsuario(sessaoOperador, "events", [
      { method: "equal", attribute: "tenant_id", values: [tenantId] },
      { method: "equal", attribute: "owner_id", values: [operadorUserId] },
      { method: "limit", values: [50] }
    ]);
    checar("na tela o operador vê apenas a tabela dele", naTela.total === 1, `${naTela.total} evento(s)`);

    // (b) O TESTE QUE IMPORTA: consulta direta, sem o filtro de dono
    const vazamentoEventos = await consultarComoUsuario(sessaoOperador, "events", [
      { method: "equal", attribute: "tenant_id", values: [tenantId] },
      { method: "limit", values: [50] }
    ]);

    const vazamentoAtletas = await consultarComoUsuario(sessaoOperador, "participants", [
      { method: "equal", attribute: "event_id", values: [eventoAdmin.$id] },
      { method: "limit", values: [5] }
    ]);

    console.log(`\n   [evidência] consulta direta do operador, sem filtro de dono:`);
    console.log(`     eventos do ambiente que ele conseguiu ler : ${vazamentoEventos.total}`);
    console.log(`     atletas da tabela da Aline que ele leu    : ${vazamentoAtletas.total}`);

    checar(
      "operador NÃO lê os eventos de outro usuário pela API",
      vazamentoEventos.total <= 1,
      `leu ${vazamentoEventos.total} de 2`
    );
    checar(
      "operador NÃO lê os atletas de outro usuário pela API",
      vazamentoAtletas.total === 0,
      `leu ${vazamentoAtletas.total} atleta(s) alheio(s)`
    );
  } finally {
    console.log("\nLimpeza");
    await limpar([eventoAdmin, eventoOperador], operatorId, admin.jwt);
    console.log("  dados de teste removidos");
  }

  console.log(`\n=== ${falhas === 0 ? "TUDO CONFORME" : `${falhas} PONTO(S) DIVERGENTE(S)`} ===`);
}

main().catch(async (err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});

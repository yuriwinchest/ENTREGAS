/**
 * Operações destrutivas em massa sobre os atletas.
 *
 * ============================ LEIA ANTES DE MEXER ============================
 * Nas escritas em lote, o Appwrite lê `queries` APENAS do corpo da requisição.
 * Se o filtro for para a query string, ele é ignorado em silêncio e a operação
 * atinge a COLLECTION INTEIRA — todos os tenants, todos os eventos.
 *
 * Foi exatamente assim que a base de atletas foi apagada em 18/08/2026.
 *
 * Por isso, aqui:
 *   1. `queries` vai SEMPRE no corpo;
 *   2. o filtro de tenant é obrigatório e verificado antes de executar;
 *   3. a contagem é conferida antes e depois, e uma divergência grande é
 *      registrada como erro;
 *   4. nada disso é exposto ao navegador — só este arquivo chama esses
 *      endpoints, e só depois de validar a permissão de quem pediu.
 * ============================================================================
 */

import { admin, DATABASE_ID, COLLECTIONS, q, qs, ApiError } from "./appwrite.js";
import { exigirPermissao } from "./identity.js";

/** Monta o filtro e recusa qualquer chamada que não esteja presa a um tenant. */
function montarFiltro(tenantId, eventId, extras = []) {
  if (!tenantId) {
    throw new ApiError(500, "Operação em massa sem tenant é proibida.");
  }

  const filtros = [q.equal("tenant_id", tenantId), ...extras];
  if (eventId) filtros.push(q.equal("event_id", eventId));

  return filtros;
}

async function contar(filtros) {
  const res = await admin(
    `/databases/${DATABASE_ID}/collections/${COLLECTIONS.PARTICIPANTS}/documents?${qs([
      ...filtros,
      q.limit(1)
    ])}`
  );
  return res.total;
}

/** Confere se o evento existe e é do tenant de quem pediu. */
async function validarEvento(tenantId, eventId) {
  if (!eventId) return null;

  const evento = await admin(
    `/databases/${DATABASE_ID}/collections/${COLLECTIONS.EVENTS}/documents/${eventId}`
  ).catch(() => null);

  if (!evento) throw new ApiError(404, "Evento não encontrado.");
  if (evento.tenant_id !== tenantId) throw new ApiError(403, "Este evento é de outro ambiente.");

  return evento;
}

export async function excluirAtletas(ctx, body) {
  exigirPermissao(ctx, "data.purge");

  const tenantId = ctx.tenant.$id;
  const eventId = body.eventId || null;
  await validarEvento(tenantId, eventId);

  const filtros = montarFiltro(tenantId, eventId);
  const antes = await contar(filtros);

  if (antes === 0) return { deleted: 0, before: 0, after: 0 };

  // Quantos documentos existem no total, para detectar um filtro ignorado.
  const totalDaCollection = await contar([]);

  await admin(`/databases/${DATABASE_ID}/collections/${COLLECTIONS.PARTICIPANTS}/documents`, {
    method: "DELETE",
    body: { queries: filtros }
  });

  const depois = await contar(filtros);
  const sobrouNaCollection = await contar([]);
  const excluidos = antes - depois;

  // Rede de segurança: se sumiu mais do que o filtro pedia, algo está errado
  // com o servidor e a operação precisa aparecer no log como incidente.
  const excluidosDeVerdade = totalDaCollection - sobrouNaCollection;
  if (excluidosDeVerdade > antes) {
    throw new ApiError(
      500,
      `Inconsistência grave: o filtro pedia ${antes} exclusões e ${excluidosDeVerdade} documentos sumiram. ` +
        `Verifique a base imediatamente.`
    );
  }

  return { deleted: excluidos, before: antes, after: depois };
}

export async function resetarEntregas(ctx, body) {
  exigirPermissao(ctx, "data.reset");

  const tenantId = ctx.tenant.$id;
  const eventId = body.eventId || null;
  await validarEvento(tenantId, eventId);

  // Só os que estão entregues entram no reset.
  const filtros = montarFiltro(tenantId, eventId, [q.isNotNull("delivered_at")]);
  const antes = await contar(filtros);

  if (antes === 0) return { reset: 0, before: 0 };

  const entreguesNaCollection = await contar([q.isNotNull("delivered_at")]);

  await admin(`/databases/${DATABASE_ID}/collections/${COLLECTIONS.PARTICIPANTS}/documents`, {
    method: "PATCH",
    body: {
      queries: filtros,
      data: { delivered_at: null, receiver_name: null }
    }
  });

  const depois = await contar(filtros);
  const entreguesRestantes = await contar([q.isNotNull("delivered_at")]);
  const resetados = antes - depois;

  const resetadosDeVerdade = entreguesNaCollection - entreguesRestantes;
  if (resetadosDeVerdade > antes) {
    throw new ApiError(
      500,
      `Inconsistência grave: o filtro pedia ${antes} resets e ${resetadosDeVerdade} registros mudaram. ` +
        `Verifique a base imediatamente.`
    );
  }

  return { reset: resetados, before: antes };
}

/** Exclui um evento inteiro: primeiro os atletas dele, depois o evento. */
export async function excluirEvento(ctx, body) {
  exigirPermissao(ctx, "event.delete");

  const tenantId = ctx.tenant.$id;
  const eventId = body.eventId;

  if (!eventId) throw new ApiError(400, "Evento não informado.");
  await validarEvento(tenantId, eventId);

  const filtros = montarFiltro(tenantId, eventId);
  const atletas = await contar(filtros);

  if (atletas > 0) {
    await admin(`/databases/${DATABASE_ID}/collections/${COLLECTIONS.PARTICIPANTS}/documents`, {
      method: "DELETE",
      body: { queries: filtros }
    });
  }

  const sobraram = await contar(filtros);
  if (sobraram > 0) {
    throw new ApiError(500, `Ainda restam ${sobraram} atletas no evento; o evento não foi excluído.`);
  }

  await admin(`/databases/${DATABASE_ID}/collections/${COLLECTIONS.EVENTS}/documents/${eventId}`, {
    method: "DELETE"
  });

  return { deleted: true, athletesDeleted: atletas };
}

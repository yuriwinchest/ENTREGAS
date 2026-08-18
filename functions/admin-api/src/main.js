/**
 * CHIPOWER — admin-api
 *
 * Function privilegiada responsável por tudo que não pode passar pelo navegador:
 * provisionamento de contas, vínculo de ambiente (tenant) e concessão de permissões.
 *
 * A API key vive apenas aqui dentro, como variável de ambiente da Function.
 * O front chama isto com a sessão do usuário e recebe de volta somente o que
 * o servidor decidiu que ele pode ver.
 */

import { ApiError } from "./appwrite.js";
import { resolverChamador } from "./identity.js";
import {
  listarOperadores,
  criarOperador,
  atualizarOperador,
  excluirOperador,
  reconciliarEquipe
} from "./operators.js";
import { excluirAtletas, resetarEntregas, excluirEvento } from "./bulkData.js";
import { PERMISSION_KEYS } from "./permissions.js";

const ACOES = {
  bootstrap: async (ctx) => ({
    provisioned: ctx.provisioned,
    user: { id: ctx.userId, name: ctx.usuario.name, email: ctx.usuario.email },
    tenant: ctx.tenant
      ? {
          id: ctx.tenant.$id,
          name: ctx.tenant.name,
          team_id: ctx.tenant.team_id,
          owner_user_id: ctx.tenant.owner_user_id
        }
      : null,
    operator: ctx.operador
      ? { id: ctx.operador.$id, name: ctx.operador.name, role: ctx.operador.role }
      : null,
    permissions: ctx.permissoes,
    catalog: PERMISSION_KEYS
  }),

  listOperators: listarOperadores,
  createOperator: criarOperador,
  updateOperator: atualizarOperador,
  deleteOperator: excluirOperador,
  repairTeam: reconciliarEquipe,

  // Operações destrutivas em massa. Vivem no servidor de propósito — ver o
  // cabeçalho de bulkData.js para o porquê.
  purgeParticipants: excluirAtletas,
  resetDeliveries: resetarEntregas,
  deleteEvent: excluirEvento
};

export default async ({ req, res, log, error }) => {
  let body = {};

  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.json({ ok: false, message: "Corpo da requisição inválido." }, 400);
  }

  const acao = String(body.action || "");
  const handler = ACOES[acao];

  if (!handler) {
    return res.json({ ok: false, message: `Ação desconhecida: ${acao || "(vazia)"}` }, 400);
  }

  try {
    const contexto = await resolverChamador(req, body);
    log(`ação=${acao} usuário=${contexto.userId} tenant=${contexto.tenant?.$id || "-"}`);

    const dados = await handler(contexto, body);
    return res.json({ ok: true, ...dados });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    if (status >= 500) error(`falha em ${acao}: ${err.stack || err.message}`);
    else log(`recusado em ${acao}: ${err.message}`);

    return res.json({ ok: false, message: err.message || "Falha inesperada." }, status);
  }
};

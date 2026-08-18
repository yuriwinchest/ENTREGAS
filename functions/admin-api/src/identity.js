/**
 * Resolução e verificação da identidade de quem chamou a Function.
 *
 * Nunca confiamos em nada que o navegador mande no corpo da requisição:
 *  - o JWT é validado contra o próprio Appwrite (`/account`);
 *  - os headers `x-appwrite-user-*` são injetados pelo servidor, não pelo cliente.
 */

import { admin, asUser, docs, COLLECTIONS, q, ApiError } from "./appwrite.js";

async function identificarUsuario(req, body) {
  const jwt = body?.jwt || req.headers?.["x-appwrite-user-jwt"];

  if (jwt) {
    const conta = await asUser("/account", jwt);
    if (!conta?.$id) throw new ApiError(401, "Sessão inválida ou expirada.");
    return conta.$id;
  }

  const headerUserId = req.headers?.["x-appwrite-user-id"];
  if (headerUserId) return headerUserId;

  throw new ApiError(401, "Requisição sem credencial de sessão.");
}

/**
 * Devolve o contexto completo do chamador: usuário, operador, tenant e permissões.
 * `provisioned: false` significa conta autenticada mas sem ambiente vinculado.
 */
export async function resolverChamador(req, body) {
  const userId = await identificarUsuario(req, body);
  const usuario = await admin(`/users/${userId}`);

  if (usuario.status === false) {
    throw new ApiError(403, "Este acesso foi desativado pelo administrador.");
  }

  const operadores = await docs.list(COLLECTIONS.OPERATORS, [q.equal("user_id", userId), q.limit(1)]);
  const operador = operadores.documents?.[0] || null;

  if (!operador || !operador.tenant_id) {
    return { userId, usuario, operador: null, tenant: null, permissoes: [], provisioned: false };
  }

  if (operador.is_active === false) {
    throw new ApiError(403, "Este acesso foi desativado pelo administrador.");
  }

  const tenant = await docs.get(COLLECTIONS.TENANTS, operador.tenant_id).catch(() => null);

  if (!tenant || tenant.is_active === false) {
    throw new ApiError(403, "O ambiente vinculado a esta conta está inativo.");
  }

  return {
    userId,
    usuario,
    operador,
    tenant,
    permissoes: operador.permissions || [],
    provisioned: true
  };
}

export function exigirPermissao(contexto, chave) {
  if (!contexto.provisioned) {
    throw new ApiError(403, "Conta sem ambiente vinculado. Solicite acesso ao administrador.");
  }
  if (!contexto.permissoes.includes(chave)) {
    throw new ApiError(403, `Permissão negada: ${chave}.`);
  }
}

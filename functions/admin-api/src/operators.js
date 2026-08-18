/**
 * Operações privilegiadas sobre a equipe de um tenant.
 *
 * Toda escrita em `operators` acontece exclusivamente aqui, com a API key.
 * A collection não concede escrita a nenhum cliente — é isso que impede um
 * operador de simplesmente editar o próprio documento e virar administrador.
 */

import { admin, docs, COLLECTIONS, q, ApiError, tenantDocPermissions } from "./appwrite.js";
import { sanitizePermissions, DEFAULT_OPERATOR_PERMISSIONS, ADMIN_PERMISSIONS } from "./permissions.js";
import { exigirPermissao } from "./identity.js";

const SENHA_MINIMA = 8;

const normalizar = (valor, max) => String(valor ?? "").trim().slice(0, max);

function validarEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "E-mail inválido.");
  }
}

async function carregarOperador(tenantId, operatorId) {
  if (!operatorId) throw new ApiError(400, "Operador não informado.");

  const doc = await docs.get(COLLECTIONS.OPERATORS, operatorId).catch((err) => {
    if (err.status === 404) throw new ApiError(404, "Operador não encontrado.");
    throw err;
  });

  if (doc.tenant_id !== tenantId) throw new ApiError(403, "Operador pertence a outro ambiente.");

  return doc;
}

// ---------------------------------------------------------------------------

export async function listarOperadores(ctx) {
  exigirPermissao(ctx, "team.manage");

  const res = await docs.list(COLLECTIONS.OPERATORS, [
    q.equal("tenant_id", ctx.tenant.$id),
    q.orderDesc("$createdAt"),
    q.limit(100)
  ]);

  return { operators: res.documents };
}

export async function criarOperador(ctx, body) {
  exigirPermissao(ctx, "team.manage");

  const name = normalizar(body.name, 128);
  const email = normalizar(body.email, 128).toLowerCase();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : "operador";

  if (!name) throw new ApiError(400, "Informe o nome do operador.");
  validarEmail(email);
  if (password.length < SENHA_MINIMA) {
    throw new ApiError(400, `A senha deve ter no mínimo ${SENHA_MINIMA} caracteres.`);
  }

  const jaExiste = await docs.list(COLLECTIONS.OPERATORS, [q.equal("email", email), q.limit(1)]);
  if (jaExiste.documents?.length) {
    throw new ApiError(409, "Já existe um operador cadastrado com este e-mail.");
  }

  const permissions = sanitizePermissions(
    body.permissions?.length ? body.permissions : role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_OPERATOR_PERMISSIONS,
    role
  );

  const usuario = await admin("/users", {
    method: "POST",
    body: { userId: "unique()", email, password, name }
  }).catch((err) => {
    if (err.status === 409) throw new ApiError(409, "Já existe uma conta com este e-mail no sistema.");
    throw err;
  });

  const teamId = ctx.tenant.team_id;

  try {
    await admin(`/teams/${teamId}/memberships`, {
      method: "POST",
      body: { userId: usuario.$id, roles: role === "admin" ? ["admin"] : ["operador"] }
    });

    const operador = await docs.create(
      COLLECTIONS.OPERATORS,
      "unique()",
      {
        name,
        email,
        role,
        is_active: true,
        user_id: usuario.$id,
        tenant_id: ctx.tenant.$id,
        created_by: ctx.userId,
        permissions
      },
      [`read("team:${teamId}")`]
    );

    return { operator: operador };
  } catch (err) {
    // Rollback: não deixamos uma conta órfã sem vínculo de ambiente.
    await admin(`/users/${usuario.$id}`, { method: "DELETE" }).catch(() => {});
    throw err;
  }
}

export async function atualizarOperador(ctx, body) {
  exigirPermissao(ctx, "team.manage");

  const alvo = await carregarOperador(ctx.tenant.$id, String(body.operatorId || ""));
  const ehDono = alvo.user_id === ctx.tenant.owner_user_id;

  const role = body.role === "admin" ? "admin" : body.role === "operador" ? "operador" : alvo.role;
  if (ehDono && role !== "admin") {
    throw new ApiError(400, "O dono do ambiente não pode deixar de ser administrador.");
  }

  const dados = { role };

  if (body.name !== undefined) dados.name = normalizar(body.name, 128) || alvo.name;

  if (body.permissions !== undefined) {
    dados.permissions = ehDono ? ADMIN_PERMISSIONS : sanitizePermissions(body.permissions, role);
  } else if (role !== alvo.role) {
    dados.permissions = sanitizePermissions(alvo.permissions || [], role);
  }

  if (body.is_active !== undefined) {
    if (ehDono && body.is_active === false) {
      throw new ApiError(400, "O dono do ambiente não pode ser desativado.");
    }
    dados.is_active = Boolean(body.is_active);
  }

  const operador = await docs.update(COLLECTIONS.OPERATORS, alvo.$id, dados);

  if (alvo.user_id) {
    // Desativar precisa valer no servidor de autenticação, não só na UI.
    if (dados.is_active !== undefined) {
      await admin(`/users/${alvo.user_id}/status`, {
        method: "PATCH",
        body: { status: dados.is_active }
      }).catch(() => {});
    }

    if (body.password) {
      if (String(body.password).length < SENHA_MINIMA) {
        throw new ApiError(400, `A senha deve ter no mínimo ${SENHA_MINIMA} caracteres.`);
      }
      await admin(`/users/${alvo.user_id}/password`, {
        method: "PATCH",
        body: { password: String(body.password) }
      });
    }
  }

  return { operator: operador };
}

export async function excluirOperador(ctx, body) {
  exigirPermissao(ctx, "team.manage");

  const alvo = await carregarOperador(ctx.tenant.$id, String(body.operatorId || ""));

  if (alvo.user_id === ctx.tenant.owner_user_id) {
    throw new ApiError(400, "O dono do ambiente não pode ser excluído.");
  }
  if (alvo.user_id === ctx.userId) {
    throw new ApiError(400, "Você não pode excluir o seu próprio acesso.");
  }

  await docs.remove(COLLECTIONS.OPERATORS, alvo.$id);

  if (alvo.user_id) {
    // Excluir a conta remove sessões e memberships junto.
    await admin(`/users/${alvo.user_id}`, { method: "DELETE" }).catch(() => {});
  }

  return { deleted: true };
}

/**
 * Reconcilia o vínculo de Team de um operador. Serve como reparo caso uma
 * membership tenha sido removida manualmente no console do Appwrite.
 */
export async function reconciliarEquipe(ctx) {
  exigirPermissao(ctx, "team.manage");

  const teamId = ctx.tenant.team_id;
  const res = await docs.list(COLLECTIONS.OPERATORS, [q.equal("tenant_id", ctx.tenant.$id), q.limit(100)]);
  let reparados = 0;

  for (const op of res.documents) {
    if (!op.user_id) continue;
    try {
      await admin(`/teams/${teamId}/memberships`, {
        method: "POST",
        body: { userId: op.user_id, roles: op.role === "admin" ? ["admin"] : ["operador"] }
      });
      reparados++;
    } catch (err) {
      if (err.status !== 409) throw err;
    }
    // Garante que o documento seja legível por todo o Team do tenant.
    await docs.update(COLLECTIONS.OPERATORS, op.$id, {}, [`read("team:${teamId}")`]);
  }

  return { repaired: reparados, total: res.documents.length };
}

/**
 * Catálogo canônico de permissões do sistema.
 *
 * Este arquivo é o espelho de `web/src/lib/permissions.ts`. Os dois precisam
 * andar juntos: o front usa para desenhar a UI, a Function usa para validar.
 * Quem manda é a Function — a UI é só conveniência visual.
 */

export const PERMISSION_KEYS = [
  "tab.desk",
  "tab.telao",
  "tab.participants",
  "tab.settings",
  "event.create",
  "event.edit",
  "event.delete",
  "event.view_all",
  "athlete.import",
  "athlete.export",
  "athlete.edit",
  "athlete.delete",
  "data.purge",
  "data.reset",
  "delivery.confirm",
  "team.manage"
];

/** Permissões que só fazem sentido para um administrador do tenant. */
export const ADMIN_ONLY_KEYS = ["team.manage", "tab.settings", "event.view_all"];

export const ADMIN_PERMISSIONS = [...PERMISSION_KEYS];

/** Mínimo para trabalhar o balcão: pesquisar, confirmar e anexar a planilha. */
export const DEFAULT_OPERATOR_PERMISSIONS = [
  "tab.desk",
  "delivery.confirm",
  "tab.participants",
  "athlete.import"
];

/** Remove chaves desconhecidas e — para não-admin — as exclusivas de admin. */
export function sanitizePermissions(list, role) {
  const requested = Array.isArray(list) ? list : [];
  const valid = requested.filter((key) => PERMISSION_KEYS.includes(key));

  if (role === "admin") return [...new Set([...valid, "team.manage", "tab.settings"])];

  return [...new Set(valid.filter((key) => !ADMIN_ONLY_KEYS.includes(key) || key === "event.view_all"))];
}

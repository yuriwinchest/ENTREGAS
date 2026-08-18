import { Query, Permission, Role } from "appwrite";

/**
 * Contexto de tenant do usuário logado.
 *
 * Toda leitura e escrita da aplicação passa por aqui. A regra é simples e
 * inegociável: sem contexto carregado, nenhuma consulta sai daqui com escopo
 * aberto — preferimos falhar do que devolver dados de outro ambiente.
 *
 * Isso é a camada de conveniência. O isolamento real é garantido pelo Appwrite
 * via permissões de documento por Team (ver tools/harden_permissions.mjs).
 */

export interface TenantContext {
  tenantId: string;
  teamId: string;
  userId: string;
  userName: string;
  operatorId: string;
  role: "admin" | "operador";
  permissions: string[];
}

let contexto: TenantContext | null = null;

/**
 * Ids dos eventos que o usuário atual enxerga. Usado quando ele opera na visão
 * "todas as tabelas" sem ter a permissão de ver o que a equipe inteira anexou.
 */
let eventosVisiveis: string[] = [];

export const setTenantContext = (novo: TenantContext | null) => {
  contexto = novo;
  if (!novo) eventosVisiveis = [];
};

export const getTenantContext = () => contexto;

export const setVisibleEventIds = (ids: string[]) => {
  eventosVisiveis = ids;
};

export const getVisibleEventIds = () => eventosVisiveis;

export class SemTenantError extends Error {
  constructor() {
    super("Sessão sem ambiente vinculado. Faça login novamente.");
    this.name = "SemTenantError";
  }
}

export function requireTenant(): TenantContext {
  if (!contexto?.tenantId) throw new SemTenantError();
  return contexto;
}

export const can = (permission: string) => Boolean(contexto?.permissions.includes(permission));

/** Permissões gravadas em cada documento: todo o Team do tenant enxerga. */
export function tenantDocumentPermissions(): string[] {
  const { teamId } = requireTenant();
  return [
    Permission.read(Role.team(teamId)),
    Permission.update(Role.team(teamId)),
    Permission.delete(Role.team(teamId))
  ];
}

/** Prefixo obrigatório de qualquer consulta às collections operacionais. */
export function tenantScope(): string[] {
  return [Query.equal("tenant_id", requireTenant().tenantId)];
}

/**
 * Resolve o filtro de evento respeitando a visibilidade do usuário.
 *
 * - evento específico  -> filtra por ele;
 * - "todas as tabelas" -> filtra pelos eventos que o usuário pode ver, a menos
 *   que ele tenha `event.view_all` (aí o escopo de tenant já basta).
 */
export function eventScope(eventId?: string | null): string[] {
  if (eventId && eventId !== "all") return [Query.equal("event_id", eventId)];

  if (can("event.view_all")) return [];

  // Sem nenhuma tabela própria, o usuário não pode cair no escopo aberto.
  if (eventosVisiveis.length === 0) return [Query.equal("event_id", "__sem_acesso__")];

  return [Query.equal("event_id", eventosVisiveis)];
}

/** Filtro de propriedade aplicado à listagem de eventos. */
export function ownerScope(): string[] {
  if (can("event.view_all")) return [];
  return [Query.equal("owner_id", requireTenant().userId)];
}

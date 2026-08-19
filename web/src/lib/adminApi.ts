import { ExecutionMethod } from "appwrite";
import { functions, ADMIN_FUNCTION_ID } from "./appwrite/client";
import { auth } from "./appwrite/auth";
import { OperatorUser } from "../types";
import { PermissionKey } from "./permissions";

/**
 * Cliente da Function `admin-api`.
 *
 * Tudo que envolve criar conta, mudar permissão ou desativar acesso passa por
 * aqui. O navegador nunca vê a API key — ele apenas prova quem é (JWT) e recebe
 * de volta a decisão do servidor.
 */

export interface SessionBootstrap {
  provisioned: boolean;
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string; team_id: string; owner_user_id: string } | null;
  operator: { id: string; name: string; role: "admin" | "operador" } | null;
  permissions: PermissionKey[];
}

export class AdminApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AdminApiError";
  }
}

/**
 * Tentativas extras para absorver o cold start do runtime da Function.
 *
 * Depois de cada publicação da Function o contêiner sobe do zero e a primeira
 * chamada pode estourar o tempo de duas formas diferentes: o Appwrite devolve
 * 408 antes da resposta, ou a execução volta 5xx com "Execution timed out".
 * As duas são transitórias e valem uma nova tentativa; qualquer outra falha
 * sobe na hora, porque insistir num erro real só atrasa o operador.
 */
// Duas tentativas, não três: quando a execução trava ela só volta no timeout
// do servidor (~30s), e três tentativas faziam o pior caso passar de 90s.
// Aqui só sobraram ações de administrador, raras e tolerantes a espera.
const TENTATIVAS = 2;
const ESPERA_ENTRE_TENTATIVAS_MS = 1500;

const ehTimeoutDeColdStart = (err: any) =>
  err?.code === 408 || err?.type === "function_synchronous_timeout";

/** Execução que subiu, mas morreu antes de responder. */
const ehExecucaoQueMorreu = (execution: any) =>
  !execution?.responseBody ||
  execution.responseStatusCode === 0 ||
  execution.responseStatusCode >= 500;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function executar(action: string, payload: Record<string, unknown>) {
  // O JWT é de curta duração: renovado a cada tentativa.
  const jwt = await auth.createJWT();

  return functions.createExecution(
    ADMIN_FUNCTION_ID,
    JSON.stringify({ action, jwt, ...payload }),
    false,
    "/",
    ExecutionMethod.POST
  );
}

async function chamar<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let ultimoErro: any = null;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    let execution;

    try {
      execution = await executar(action, payload);
    } catch (err: any) {
      ultimoErro = err;

      // Na primeira chamada o contêiner da Function ainda está subindo e o
      // Appwrite devolve 408 antes da resposta. Vale insistir.
      if (ehTimeoutDeColdStart(err) && tentativa < TENTATIVAS) {
        await esperar(ESPERA_ENTRE_TENTATIVAS_MS);
        continue;
      }

      throw new AdminApiError(
        ehTimeoutDeColdStart(err)
          ? "O servidor de administração demorou para responder. Tente novamente."
          : err?.message || "Falha ao falar com o servidor de administração.",
        err?.code || 500
      );
    }

    if (ehExecucaoQueMorreu(execution) && tentativa < TENTATIVAS) {
      ultimoErro = new AdminApiError("A execução no servidor não respondeu a tempo.", 500);
      await esperar(ESPERA_ENTRE_TENTATIVAS_MS);
      continue;
    }

    let corpo: any = {};
    try {
      corpo = JSON.parse(execution.responseBody || "{}");
    } catch {
      throw new AdminApiError("Resposta inválida do servidor de administração.", 500);
    }

    if (!corpo.ok) {
      throw new AdminApiError(
        corpo.message || "Não foi possível concluir a operação.",
        execution.responseStatusCode || 500
      );
    }

    return corpo as T;
  }

  throw new AdminApiError(
    ultimoErro?.message ||
      "O servidor de administração não respondeu. Aguarde alguns segundos e tente novamente.",
    ultimoErro?.code || ultimoErro?.status || 500
  );
}

export const adminApi = {
  bootstrap: () => chamar<SessionBootstrap>("bootstrap"),

  listOperators: () =>
    chamar<{ operators: OperatorUser[] }>("listOperators").then((r) => r.operators),

  createOperator: (data: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "operador";
    permissions: PermissionKey[];
  }) => chamar<{ operator: OperatorUser }>("createOperator", data).then((r) => r.operator),

  updateOperator: (
    operatorId: string,
    data: Partial<{
      name: string;
      role: "admin" | "operador";
      permissions: PermissionKey[];
      is_active: boolean;
      password: string;
    }>
  ) =>
    chamar<{ operator: OperatorUser }>("updateOperator", { operatorId, ...data }).then(
      (r) => r.operator
    ),

  deleteOperator: (operatorId: string) => chamar<{ deleted: boolean }>("deleteOperator", { operatorId }),

  repairTeam: () => chamar<{ repaired: number; total: number }>("repairTeam"),

  /**
   * Operações destrutivas em massa.
   *
   * Rodam no servidor por decisão de arquitetura: o filtro das escritas em
   * lote do Appwrite só é respeitado no corpo da requisição, e um filtro
   * ignorado apaga a collection inteira. Esse risco não fica no navegador.
   */
  purgeParticipants: (eventId: string | null) =>
    chamar<{ deleted: number; before: number; after: number }>("purgeParticipants", { eventId }),

  resetDeliveries: (eventId: string | null) =>
    chamar<{ reset: number; before: number }>("resetDeliveries", { eventId }),

  deleteEvent: (eventId: string) =>
    chamar<{ deleted: boolean; athletesDeleted: number }>("deleteEvent", { eventId })
};

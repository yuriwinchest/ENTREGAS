import { Query } from "appwrite";
import { Models } from "appwrite";
import { databases, DATABASE_ID, COLLECTIONS } from "./client";
import { OperatorUser, Tenant } from "../../types";
import { PermissionKey } from "../permissions";

/**
 * Carrega o ambiente e as permissões do usuário logado.
 *
 * POR QUE ISTO NÃO PASSA MAIS PELA FUNCTION `admin-api`:
 * o login ficava travado esperando uma execução síncrona da Function. No
 * histórico de execuções, 8 de 60 chamadas travaram entre 29 e 30 segundos e
 * morreram em "Execution timed out" — e como a chamada era repetida até três
 * vezes, uma entrada podia levar mais de um minuto e meio.
 *
 * Nada disso era necessário: os dois documentos de que o login precisa —
 * o operador e o tenant — são legíveis pela própria sessão do usuário, em
 * cerca de 60ms cada. E continuam sendo dados de confiança, porque NENHUM
 * cliente escreve nessas collections: elas não têm permissão de escrita, só a
 * Function (com a API key) grava ali.
 *
 * A Function segue existindo para o que realmente exige privilégio: criar,
 * editar e excluir usuários, e as operações destrutivas em massa.
 */

export interface ContextoDaSessao {
  provisioned: boolean;
  tenant: { id: string; name: string; team_id: string; owner_user_id: string } | null;
  operator: { id: string; name: string; role: "admin" | "operador" } | null;
  permissions: PermissionKey[];
}

const SEM_AMBIENTE: ContextoDaSessao = {
  provisioned: false,
  tenant: null,
  operator: null,
  permissions: []
};

export async function carregarContextoDaSessao(
  user: Models.User<Models.Preferences>
): Promise<ContextoDaSessao> {
  const operadores = await databases.listDocuments<OperatorUser>(
    DATABASE_ID,
    COLLECTIONS.OPERATORS,
    [Query.equal("user_id", user.$id), Query.limit(1)]
  );

  const operador = operadores.documents[0];

  // Conta autenticada mas sem vínculo: cai na tela "conta sem ambiente".
  if (!operador?.tenant_id) return SEM_AMBIENTE;

  if (operador.is_active === false) {
    throw new Error("Este acesso foi desativado pelo administrador.");
  }

  const tenant = await databases
    .getDocument<Tenant>(DATABASE_ID, COLLECTIONS.TENANTS, operador.tenant_id)
    .catch(() => null);

  if (!tenant || tenant.is_active === false) {
    throw new Error("O ambiente vinculado a esta conta está inativo.");
  }

  return {
    provisioned: true,
    tenant: {
      id: tenant.$id,
      name: tenant.name,
      team_id: tenant.team_id,
      owner_user_id: tenant.owner_user_id
    },
    operator: {
      id: operador.$id,
      name: operador.name,
      role: operador.role
    },
    permissions: (operador.permissions || []) as PermissionKey[]
  };
}

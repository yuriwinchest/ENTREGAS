import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Models } from "appwrite";
import { carregarContextoDaSessao, ContextoDaSessao, setTenantContext } from "./appwrite";
import { PermissionKey } from "./permissions";

/**
 * Sessão da aplicação: quem está logado, em qual ambiente e o que pode fazer.
 *
 * O contexto é populado por uma chamada ao servidor (`bootstrap`) — o front
 * não deduz permissão de lugar nenhum, ele apenas obedece o que recebe.
 */

export interface Session {
  user: Models.User<Models.Preferences>;
  tenant: ContextoDaSessao["tenant"];
  operator: ContextoDaSessao["operator"];
  permissions: PermissionKey[];
  provisioned: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

interface SessionState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  can: (permission: PermissionKey) => boolean;
  canAny: (...permissions: PermissionKey[]) => boolean;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  return ctx;
}

/** Atalho para gates simples de UI. */
export const useCan = (permission: PermissionKey) => useSession().can(permission);

interface SessionProviderProps {
  user: Models.User<Models.Preferences>;
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ user, children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregamentos concorrentes acontecem de verdade: o StrictMode monta o
  // provider duas vezes em desenvolvimento e o usuário pode pedir "tentar
  // novamente". Só a carga mais recente tem direito de escrever o contexto —
  // sem isso, uma resposta atrasada zerava o tenant de uma sessão já válida.
  const cargaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const carga = ++cargaAtual.current;

    setLoading(true);
    setError(null);

    try {
      // Duas leituras diretas (~60ms cada) no lugar de uma execução síncrona
      // da Function, que travava o login por até 30s quando engasgava.
      const dados = await carregarContextoDaSessao(user);
      if (carga !== cargaAtual.current) return;

      const nova: Session = {
        user,
        tenant: dados.tenant,
        operator: dados.operator,
        permissions: dados.permissions || [],
        provisioned: dados.provisioned,
        isAdmin: dados.operator?.role === "admin",
        isOwner: Boolean(dados.tenant && dados.tenant.owner_user_id === user.$id)
      };

      // Alimenta a camada de dados: a partir daqui toda query nasce com escopo.
      setTenantContext(
        dados.provisioned && dados.tenant && dados.operator
          ? {
              tenantId: dados.tenant.id,
              teamId: dados.tenant.team_id,
              userId: user.$id,
              userName: user.name || dados.operator.name,
              operatorId: dados.operator.id,
              role: dados.operator.role,
              permissions: dados.permissions || []
            }
          : null
      );

      setSession(nova);
    } catch (err: any) {
      if (carga !== cargaAtual.current) return;

      console.error("Falha ao carregar a sessão:", err);
      setTenantContext(null);
      setError(err?.message || "Não foi possível carregar as permissões desta conta.");
      setSession(null);
    } finally {
      if (carga === cargaAtual.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void carregar();

    return () => {
      // Invalida qualquer carga em andamento e limpa o escopo da camada de
      // dados, para que nenhuma consulta sobreviva à troca de usuário.
      cargaAtual.current += 1;
      setTenantContext(null);
    };
  }, [carregar]);

  const valor = useMemo<SessionState>(
    () => ({
      session,
      loading,
      error,
      can: (permission) => Boolean(session?.permissions.includes(permission)),
      canAny: (...permissions) =>
        permissions.some((permission) => Boolean(session?.permissions.includes(permission))),
      reload: carregar
    }),
    [session, loading, error, carregar]
  );

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
};

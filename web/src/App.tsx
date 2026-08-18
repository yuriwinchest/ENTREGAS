import React, { useEffect, useState } from "react";
import { Models } from "appwrite";
import { Zap, Loader2 } from "lucide-react";
import { LoginScreen } from "./components/LoginScreen";
import { Workspace } from "./components/Workspace";
import { SessionProvider } from "./lib/session";
import { auth } from "./lib/appwrite";

/**
 * Raiz da aplicação.
 *
 * Responsabilidade única: descobrir se existe sessão e entregar o usuário
 * autenticado ao <SessionProvider>. Todo o resto — dados, abas, permissões —
 * vive dentro do <Workspace>, já com o ambiente (tenant) resolvido.
 */

const TelaDeCarregamento: React.FC<{ mensagem: string }> = ({ mensagem }) => (
  <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center font-sans select-none">
    <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-4 animate-pulse">
      <Zap className="w-9 h-9 text-white fill-white" />
    </div>
    <div className="flex items-center gap-2.5 text-brand-400 font-mono text-sm">
      <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
      <span>{mensagem}</span>
    </div>
  </div>
);

export function App() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  useEffect(() => {
    let ativo = true;

    auth
      .getCurrentUser()
      .then((atual) => {
        if (ativo && atual) setUser(atual);
      })
      .catch((err) => console.warn("Sem sessão prévia:", err))
      .finally(() => {
        if (ativo) setVerificandoSessao(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const encerrarSessao = async () => {
    await auth.logout();
    setUser(null);
  };

  if (verificandoSessao) return <TelaDeCarregamento mensagem="Iniciando CHIPOWER Cloud..." />;

  if (!user) return <LoginScreen onLoginSuccess={setUser} />;

  return (
    <SessionProvider user={user}>
      <Workspace user={user} onLogout={encerrarSessao} />
    </SessionProvider>
  );
}

export default App;

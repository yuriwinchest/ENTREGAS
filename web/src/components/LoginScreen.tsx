import React, { useState } from "react";
import { 
  Zap, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Tv, 
  ShieldCheck, 
  AlertCircle, 
  Loader2,
  Sparkles,
  UserCheck
} from "lucide-react";
import { auth } from "../lib/appwrite";
import { Models } from "appwrite";

interface LoginScreenProps {
  onLoginSuccess: (user: Models.User<Models.Preferences>) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await auth.login(email.trim(), password.trim());
      const currentUser = await auth.getCurrentUser();
      if (currentUser) {
        onLoginSuccess(currentUser);
      } else {
        throw new Error("Não foi possível carregar as informações do usuário.");
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      if (err.message && err.message.includes("Invalid credentials")) {
        setError("E-mail ou senha incorretos. Verifique os dados digitados.");
      } else {
        setError(err.message || "Falha ao conectar com o servidor. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans select-none">
      
      {/* Luzes de Fundo e Gradientes Decorativos */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-500/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Header com Logotipo e Título */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-amber-500 shadow-2xl shadow-brand-500/30 mb-1 animate-pulse">
            <Zap className="w-9 h-9 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2.5">
              <h1 className="text-3xl font-black font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent">
                CHIPOWER
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-mono font-bold">
                KITS CLOUD
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Plataforma Oficial de Entrega de Kits & Cronometragem
            </p>
          </div>
        </div>

        {/* Card Principal de Login */}
        <div className="glass-card rounded-3xl p-7 sm:p-8 border border-slate-800/90 shadow-2xl shadow-black/80 bg-slate-900/80 backdrop-blur-xl">
          
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white">Acesso do Operador</h2>
              <p className="text-xs text-slate-400">Entre com sua credencial autorizada</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-mono bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Protegido</span>
            </div>
          </div>

          {/* Banner de Erro */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-scale-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Senha
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-amber-500 hover:from-brand-500 hover:to-amber-400 text-white font-bold text-sm shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Aviso de ambiente isolado */}
          <div className="mt-6 pt-5 border-t border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-500 leading-relaxed">
            <UserCheck className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
            <span>
              Cada acesso enxerga somente o ambiente e as tabelas liberados pelo administrador.
              O Telão da tenda também abre por aqui, após entrar.
            </span>
          </div>

        </div>

        {/* Rodapé de Segurança */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-brand-500" />
          <span>CHIPOWER • Appwrite Cloud Sync • v1.0.0</span>
        </div>

      </div>

    </div>
  );
};

import React from "react";
import { ShieldAlert, LogOut, RefreshCw, Lock } from "lucide-react";

interface AccessDeniedProps {
  titulo: string;
  mensagem: string;
  detalhe?: string;
  onLogout?: () => void;
  onRetry?: () => void;
}

/**
 * Tela mostrada quando a conta está autenticada mas não pode entrar:
 * ambiente não vinculado, acesso desativado ou falha ao carregar permissões.
 */
export const AccessDenied: React.FC<AccessDeniedProps> = ({
  titulo,
  mensagem,
  detalhe,
  onLogout,
  onRetry
}) => (
  <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 font-sans">
    <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white">{titulo}</h1>
        <p className="text-sm text-slate-400 leading-relaxed">{mensagem}</p>
        {detalhe && (
          <p className="text-xs text-slate-500 font-mono bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 mt-3 break-words">
            {detalhe}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2.5 pt-1">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1.5 font-mono pt-2 border-t border-slate-800">
        <Lock className="w-3 h-3" />
        Acesso controlado pelo administrador do ambiente
      </p>
    </div>
  </div>
);

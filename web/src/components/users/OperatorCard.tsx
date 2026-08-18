import React from "react";
import { Shield, User, Mail, Trash2, UserCheck, UserX, Pencil, Crown, KeyRound, Loader2 } from "lucide-react";
import { OperatorUser } from "../../types";
import { findPermission } from "../../lib/permissions";

interface OperatorCardProps {
  operador: OperatorUser;
  ehDonoDoAmbiente: boolean;
  ehVoce: boolean;
  onEditar: () => void;
  onAlternarStatus: () => void;
  onExcluir: () => void;
  onRedefinirSenha: () => void;
  redefinindoSenha: boolean;
}

export const OperatorCard: React.FC<OperatorCardProps> = ({
  operador,
  ehDonoDoAmbiente,
  ehVoce,
  onEditar,
  onAlternarStatus,
  onExcluir,
  onRedefinirSenha,
  redefinindoSenha
}) => {
  const ehAdmin = operador.role === "admin";
  const ativo = operador.is_active !== false;
  const permissoes = operador.permissions || [];

  const resumoPermissoes = permissoes
    .map((key) => findPermission(key)?.label)
    .filter(Boolean) as string[];

  return (
    <div
      className={`p-4 rounded-xl border transition-all space-y-3 ${
        ativo
          ? "bg-slate-800/40 border-slate-700/70 hover:border-slate-600"
          : "bg-slate-900/50 border-slate-800/60 opacity-70"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              ehAdmin
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            }`}
          >
            {ehAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm truncate">{operador.name}</span>

              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  ehAdmin
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                }`}
              >
                {operador.role}
              </span>

              {ehDonoDoAmbiente && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Dono
                </span>
              )}

              {ehVoce && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-700 text-slate-300">
                  Você
                </span>
              )}

              {!ativo && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  Desativado
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
              {operador.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={onRedefinirSenha}
            disabled={redefinindoSenha}
            title="Gerar uma nova senha para enviar a esta pessoa"
            className="px-2.5 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {redefinindoSenha ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Redefinir senha</span>
          </button>

          <button
            onClick={onEditar}
            title="Editar permissões e dados"
            className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {!ehDonoDoAmbiente && (
            <button
              onClick={onAlternarStatus}
              title={ativo ? "Desativar acesso" : "Reativar acesso"}
              className={`p-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                ativo
                  ? "border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              {ativo ? (
                <>
                  <UserX className="w-3.5 h-3.5" /> Desativar
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" /> Ativar
                </>
              )}
            </button>
          )}

          {!ehDonoDoAmbiente && !ehVoce && (
            <button
              onClick={onExcluir}
              title="Excluir usuário"
              className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Resumo do acesso concedido */}
      <div className="flex items-start gap-2 pl-1">
        <KeyRound className="w-3 h-3 text-slate-600 mt-1 shrink-0" />
        {ehAdmin ? (
          <span className="text-[11px] text-amber-300/80">Acesso total ao ambiente</span>
        ) : resumoPermissoes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {resumoPermissoes.map((label) => (
              <span
                key={label}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-rose-400/80">
            Nenhuma permissão concedida — este usuário não consegue abrir o sistema
          </span>
        )}
      </div>
    </div>
  );
};

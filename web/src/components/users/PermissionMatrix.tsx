import React from "react";
import { Check, Lock, AlertTriangle } from "lucide-react";
import {
  PERMISSION_GROUPS,
  PermissionKey,
  permissionsByGroup,
  ADMIN_PERMISSIONS,
  DEFAULT_OPERATOR_PERMISSIONS
} from "../../lib/permissions";

interface PermissionMatrixProps {
  value: PermissionKey[];
  onChange: (permissions: PermissionKey[]) => void;
  role: "admin" | "operador";
  disabled?: boolean;
}

/**
 * Matriz de permissões usada pelo administrador para montar o acesso de cada
 * pessoa da equipe. Administradores recebem tudo e a matriz fica só informativa.
 */
export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  value,
  onChange,
  role,
  disabled = false
}) => {
  const ehAdmin = role === "admin";
  const selecionadas = ehAdmin ? ADMIN_PERMISSIONS : value;

  const alternar = (key: PermissionKey) => {
    if (disabled || ehAdmin) return;
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          O que este usuário pode acessar
        </span>

        {!ehAdmin && !disabled && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange([...DEFAULT_OPERATOR_PERMISSIONS])}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
            >
              Padrão de balcão
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-semibold transition-colors"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {ehAdmin && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Administradores têm acesso total ao ambiente por definição. Para restringir o acesso,
            mude o perfil para <strong>Operador de Balcão</strong>.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {PERMISSION_GROUPS.map((grupo) => {
          const itens = permissionsByGroup(grupo);
          if (itens.length === 0) return null;

          return (
            <div key={grupo} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">
                {grupo}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {itens.map((permissao) => {
                  const marcada = selecionadas.includes(permissao.key);
                  const bloqueada = disabled || ehAdmin;

                  return (
                    <button
                      key={permissao.key}
                      type="button"
                      onClick={() => alternar(permissao.key)}
                      disabled={bloqueada}
                      title={permissao.description}
                      className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                        marcada
                          ? permissao.destructive
                            ? "bg-rose-500/10 border-rose-500/40"
                            : "bg-cyan-500/10 border-cyan-500/40"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      } ${bloqueada ? "cursor-default opacity-80" : "cursor-pointer"}`}
                    >
                      <span
                        className={`w-4 h-4 rounded shrink-0 mt-0.5 border flex items-center justify-center ${
                          marcada
                            ? permissao.destructive
                              ? "bg-rose-500 border-rose-500"
                              : "bg-cyan-500 border-cyan-500"
                            : "border-slate-600"
                        }`}
                      >
                        {marcada && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>

                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold ${marcada ? "text-white" : "text-slate-300"}`}
                          >
                            {permissao.label}
                          </span>
                          {permissao.destructive && (
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                          )}
                        </span>
                        <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                          {permissao.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

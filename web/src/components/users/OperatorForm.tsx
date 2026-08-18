import React, { useEffect, useState } from "react";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Save
} from "lucide-react";
import { OperatorUser } from "../../types";
import { PermissionKey, DEFAULT_OPERATOR_PERMISSIONS, ADMIN_PERMISSIONS } from "../../lib/permissions";
import { PermissionMatrix } from "./PermissionMatrix";

export interface OperatorFormValues {
  name: string;
  email: string;
  password: string;
  role: "admin" | "operador";
  permissions: PermissionKey[];
}

interface OperatorFormProps {
  /** Preenchido em modo edição; ausente em modo criação. */
  operador?: OperatorUser | null;
  saving: boolean;
  error: string | null;
  onSubmit: (values: OperatorFormValues) => void;
  onCancel: () => void;
}

const SENHA_MINIMA = 8;

export const OperatorForm: React.FC<OperatorFormProps> = ({
  operador,
  saving,
  error,
  onSubmit,
  onCancel
}) => {
  const editando = Boolean(operador);

  const [name, setName] = useState(operador?.name || "");
  const [email, setEmail] = useState(operador?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"admin" | "operador">(operador?.role || "operador");
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    (operador?.permissions as PermissionKey[]) || [...DEFAULT_OPERATOR_PERMISSIONS]
  );
  const [validacao, setValidacao] = useState<string | null>(null);

  // Promover a administrador libera tudo; rebaixar volta ao mínimo operacional.
  useEffect(() => {
    if (role === "admin") setPermissions([...ADMIN_PERMISSIONS]);
    else if (permissions.length === ADMIN_PERMISSIONS.length)
      setPermissions([...DEFAULT_OPERATOR_PERMISSIONS]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setValidacao(null);

    if (!name.trim()) return setValidacao("Informe o nome completo.");
    if (!editando && !email.trim()) return setValidacao("Informe o e-mail de acesso.");

    const querTrocarSenha = password.trim().length > 0;
    if ((!editando || querTrocarSenha) && password.trim().length < SENHA_MINIMA) {
      return setValidacao(`A senha deve ter no mínimo ${SENHA_MINIMA} caracteres.`);
    }

    if (role !== "admin" && permissions.length === 0) {
      return setValidacao("Selecione ao menos uma permissão para este usuário.");
    }

    onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role,
      permissions
    });
  };

  const mensagem = validacao || error;

  return (
    <form
      onSubmit={enviar}
      className="p-5 bg-slate-800/60 border border-amber-500/30 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200"
    >
      <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
        <UserPlus className="w-4 h-4" />
        {editando ? `Editando ${operador?.name}` : "Cadastrar novo usuário"}
      </h3>

      {mensagem && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{mensagem}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Nome completo *</label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              required
              placeholder="Ex: João da Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            E-mail de acesso {editando ? "" : "*"}
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="email"
              required={!editando}
              disabled={editando}
              placeholder="joao@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          {editando && (
            <p className="text-[11px] text-slate-500 mt-1">O e-mail de login não pode ser alterado.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {editando ? "Nova senha (opcional)" : `Senha de acesso (mínimo ${SENHA_MINIMA}) *`}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              required={!editando}
              autoComplete="new-password"
              placeholder={editando ? "Deixe em branco para manter" : "********"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Perfil</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("operador")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                role === "operador"
                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Operador de Balcão
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                role === "admin"
                  ? "bg-amber-500/20 border-amber-500 text-amber-300"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Administrador
            </button>
          </div>
        </div>
      </div>

      <PermissionMatrix value={permissions} onChange={setPermissions} role={role} disabled={saving} />

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/50">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
            </>
          ) : editando ? (
            <>
              <Save className="w-3.5 h-3.5" /> Salvar alterações
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Criar usuário
            </>
          )}
        </button>
      </div>
    </form>
  );
};

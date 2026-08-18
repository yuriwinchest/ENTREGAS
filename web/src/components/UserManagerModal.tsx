import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX
} from "lucide-react";
import { OperatorUser } from "../types";
import { api } from "../lib/appwrite";

interface UserManagerModalProps {
  onClose: () => void;
}

export const UserManagerModal: React.FC<UserManagerModalProps> = ({ onClose }) => {
  const [operators, setOperators] = useState<OperatorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete State
  const [operatorToDelete, setOperatorToDelete] = useState<OperatorUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const data = await api.listOperators();
      setOperators(data);
    } catch (err) {
      console.error("Erro ao carregar operadores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperators();
  }, []);

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createOperator({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role: role
      });

      setName("");
      setEmail("");
      setPassword("");
      setRole("operador");
      setIsCreating(false);
      setSuccessMsg("Operador criado com sucesso!");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadOperators();
    } catch (err: any) {
      console.error("Erro ao criar operador:", err);
      setError(err?.message || "Erro ao cadastrar operador. Verifique os dados.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (operator: OperatorUser) => {
    try {
      await api.updateOperator(operator.$id, {
        is_active: !operator.is_active
      });
      setOperators(prev =>
        prev.map(op => (op.$id === operator.$id ? { ...op, is_active: !op.is_active } : op))
      );
    } catch (err) {
      console.error("Erro ao alterar status:", err);
      alert("Erro ao alterar status do operador.");
    }
  };

  const handleDeleteOperator = async () => {
    if (!operatorToDelete) return;
    setDeletingId(operatorToDelete.$id);
    try {
      await api.deleteOperator(operatorToDelete.$id);
      setOperators(prev => prev.filter(op => op.$id !== operatorToDelete.$id));
      setOperatorToDelete(null);
    } catch (err) {
      console.error("Erro ao excluir operador:", err);
      alert("Erro ao excluir operador.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Gestão de Equipe e Operadores
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold uppercase">
                  Admin
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre e gerencie os usuários autorizados a operar a entrega de kits
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Mensagem de Sucesso */}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-sm font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">
              Operadores Cadastrados ({operators.length})
            </span>
            <button
              onClick={() => {
                setIsCreating(!isCreating);
                setError(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
                isCreating
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/20"
              }`}
            >
              {isCreating ? (
                <>
                  <X className="w-4 h-4" /> Cancelar
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Novo Operador
                </>
              )}
            </button>
          </div>

          {/* Form de Criação */}
          {isCreating && (
            <form
              onSubmit={handleCreateOperator}
              className="p-5 bg-slate-800/60 border border-amber-500/30 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200"
            >
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Cadastrar Novo Usuário
              </h3>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: João da Silva"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail de Acesso *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="joao@exemplo.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Senha de Acesso (Mínimo 8 caracteres) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="********"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Perfil de Permissão
                  </label>
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

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
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
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Criar Operador
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Lista de Operadores */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
              <p className="text-sm">Carregando lista de operadores...</p>
            </div>
          ) : operators.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/30 border border-slate-800 rounded-xl">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-slate-400 text-sm">Nenhum operador adicional cadastrado.</p>
              <p className="text-slate-500 text-xs mt-1">
                Clique em "Novo Operador" acima para convidar membros da sua equipe.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {operators.map(op => {
                const isAdmin = op.role === "admin";
                const isActive = op.is_active !== false;

                return (
                  <div
                    key={op.$id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? "bg-slate-850 bg-slate-800/40 border-slate-700/70 hover:border-slate-600"
                        : "bg-slate-900/50 border-slate-800/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isAdmin
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{op.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              isAdmin
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                            }`}
                          >
                            {op.role}
                          </span>
                          {!isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              Inativo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {op.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleToggleStatus(op)}
                        title={isActive ? "Desativar Operador" : "Ativar Operador"}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isActive
                            ? "border-slate-700 text-slate-300 hover:bg-slate-700"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5 text-slate-400" /> Desativar
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Ativar
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setOperatorToDelete(op)}
                        title="Excluir Operador"
                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {operatorToDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Excluir Operador?</h3>
              <p className="text-sm text-slate-400 mt-1">
                Deseja remover o acesso de{" "}
                <span className="text-white font-semibold">{operatorToDelete.name}</span> (
                {operatorToDelete.email})? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setOperatorToDelete(null)}
                disabled={deletingId !== null}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteOperator}
                disabled={deletingId !== null}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingId !== null ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  Users,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Trash2,
  Building2,
  AlertCircle
} from "lucide-react";

import { OperatorUser } from "../../types";
import { adminApi } from "../../lib/adminApi";
import { useSession } from "../../lib/session";
import { OperatorForm, OperatorFormValues } from "./OperatorForm";
import { OperatorCard } from "./OperatorCard";
import { CredentialsCard } from "./CredentialsCard";
import { Credenciais, gerarSenha } from "../../lib/credenciais";

interface UserManagerModalProps {
  onClose: () => void;
}

/**
 * Gestão de equipe do ambiente.
 *
 * Nenhuma operação daqui escreve direto no banco: tudo passa pela Function
 * `admin-api`, que confere quem está pedindo antes de executar.
 */
export const UserManagerModal: React.FC<UserManagerModalProps> = ({ onClose }) => {
  const { session, reload } = useSession();

  const [operadores, setOperadores] = useState<OperatorUser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modo, setModo] = useState<"lista" | "criar" | "editar">("lista");
  const [emEdicao, setEmEdicao] = useState<OperatorUser | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [paraExcluir, setParaExcluir] = useState<OperatorUser | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Credencial recém-definida, exibida uma única vez para o admin copiar.
  const [credenciais, setCredenciais] = useState<{ dados: Credenciais; titulo: string } | null>(null);
  const [redefinindoId, setRedefinindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      setOperadores(await adminApi.listOperators());
    } catch (err: any) {
      console.error("Erro ao carregar operadores:", err);
      setErroLista(err?.message || "Não foi possível carregar a equipe.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const avisar = (mensagem: string) => {
    setSucesso(mensagem);
    setTimeout(() => setSucesso(null), 4000);
  };

  const salvar = async (values: OperatorFormValues) => {
    setSalvando(true);
    setErroFormulario(null);

    try {
      if (modo === "editar" && emEdicao) {
        await adminApi.updateOperator(emEdicao.$id, {
          name: values.name,
          role: values.role,
          permissions: values.permissions,
          ...(values.password ? { password: values.password } : {})
        });
        if (values.password) {
          setCredenciais({
            titulo: "Senha alterada",
            dados: { nome: values.name, email: emEdicao.email, senha: values.password }
          });
        } else {
          avisar(`Acesso de ${values.name} atualizado.`);
        }

        // Se o admin mexeu no próprio acesso, a sessão precisa refletir agora.
        if (emEdicao.user_id === session?.user.$id) await reload();
      } else {
        await adminApi.createOperator({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          permissions: values.permissions
        });

        // A senha só existe em texto aqui, neste instante. Depois disso o
        // servidor guarda apenas o hash — por isso o cartão abre na hora.
        setCredenciais({
          titulo: "Usuário criado",
          dados: { nome: values.name, email: values.email, senha: values.password }
        });
      }

      setModo("lista");
      setEmEdicao(null);
      await carregar();
    } catch (err: any) {
      console.error("Erro ao salvar operador:", err);
      setErroFormulario(err?.message || "Não foi possível salvar este usuário.");
    } finally {
      setSalvando(false);
    }
  };

  const alternarStatus = async (operador: OperatorUser) => {
    const ativar = operador.is_active === false;
    try {
      await adminApi.updateOperator(operador.$id, { is_active: ativar });
      setOperadores((prev) =>
        prev.map((op) => (op.$id === operador.$id ? { ...op, is_active: ativar } : op))
      );
      avisar(`Acesso de ${operador.name} ${ativar ? "reativado" : "desativado"}.`);
    } catch (err: any) {
      alert(err?.message || "Não foi possível alterar o status deste usuário.");
    }
  };

  /**
   * Gera uma senha nova e mostra para o admin enviar.
   *
   * É o caminho para "o operador esqueceu a senha": a original não pode ser
   * recuperada — o servidor guarda apenas o hash dela.
   */
  const redefinirSenha = async (operador: OperatorUser) => {
    setRedefinindoId(operador.$id);
    try {
      const novaSenha = gerarSenha();
      await adminApi.updateOperator(operador.$id, { password: novaSenha });

      setCredenciais({
        titulo: "Nova senha gerada",
        dados: { nome: operador.name, email: operador.email, senha: novaSenha }
      });
    } catch (err: any) {
      alert(err?.message || "Não foi possível redefinir a senha deste usuário.");
    } finally {
      setRedefinindoId(null);
    }
  };

  const excluir = async () => {
    if (!paraExcluir) return;
    setExcluindo(true);
    try {
      await adminApi.deleteOperator(paraExcluir.$id);
      setOperadores((prev) => prev.filter((op) => op.$id !== paraExcluir.$id));
      avisar(`Usuário ${paraExcluir.name} removido.`);
      setParaExcluir(null);
    } catch (err: any) {
      alert(err?.message || "Não foi possível excluir este usuário.");
    } finally {
      setExcluindo(false);
    }
  };

  const donoId = session?.tenant?.owner_user_id;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Gestão de Equipe
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold uppercase">
                  Admin
                </span>
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3 h-3" />
                Ambiente: <strong className="text-slate-300">{session?.tenant?.name}</strong>
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

        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {sucesso && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{sucesso}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-300">
              Usuários do ambiente ({operadores.length})
            </span>

            {modo === "lista" && (
              <button
                onClick={() => {
                  setEmEdicao(null);
                  setErroFormulario(null);
                  setModo("criar");
                }}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm shadow-amber-500/20"
              >
                <UserPlus className="w-4 h-4" /> Novo usuário
              </button>
            )}
          </div>

          {modo !== "lista" && (
            <OperatorForm
              operador={modo === "editar" ? emEdicao : null}
              saving={salvando}
              error={erroFormulario}
              onSubmit={salvar}
              onCancel={() => {
                setModo("lista");
                setEmEdicao(null);
                setErroFormulario(null);
              }}
            />
          )}

          {erroLista && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erroLista}</span>
            </div>
          )}

          {carregando ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
              <p className="text-sm">Carregando a equipe...</p>
            </div>
          ) : operadores.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/30 border border-slate-800 rounded-xl">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-slate-400 text-sm">Nenhum usuário cadastrado neste ambiente.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {operadores.map((op) => (
                <OperatorCard
                  key={op.$id}
                  operador={op}
                  ehDonoDoAmbiente={Boolean(donoId && op.user_id === donoId)}
                  ehVoce={op.user_id === session?.user.$id}
                  onEditar={() => {
                    setEmEdicao(op);
                    setErroFormulario(null);
                    setModo("editar");
                  }}
                  onAlternarStatus={() => alternarStatus(op)}
                  onExcluir={() => setParaExcluir(op)}
                  onRedefinirSenha={() => redefinirSenha(op)}
                  redefinindoSenha={redefinindoId === op.$id}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Cada usuário enxerga apenas as tabelas deste ambiente, conforme as permissões concedidas.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {credenciais && (
        <CredentialsCard
          credenciais={credenciais.dados}
          titulo={credenciais.titulo}
          onFechar={() => setCredenciais(null)}
        />
      )}

      {paraExcluir && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Excluir usuário?</h3>
              <p className="text-sm text-slate-400 mt-1">
                A conta de <span className="text-white font-semibold">{paraExcluir.name}</span> (
                {paraExcluir.email}) será removida do sistema e não poderá mais entrar. Os dados já
                lançados por ela permanecem no ambiente.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setParaExcluir(null)}
                disabled={excluindo}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={excluir}
                disabled={excluindo}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {excluindo ? (
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

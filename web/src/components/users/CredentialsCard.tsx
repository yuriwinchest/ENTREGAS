import React, { useState } from "react";
import { Copy, Check, KeyRound, Mail, Globe, MessageCircle, AlertTriangle, X } from "lucide-react";
import { Credenciais, ENDERECO_DO_SISTEMA, copiar, montarMensagem, linkDoWhatsApp } from "../../lib/credenciais";

interface CredentialsCardProps {
  credenciais: Credenciais;
  titulo: string;
  onFechar: () => void;
}

/**
 * Mostra a credencial recém-definida para o administrador copiar e enviar.
 *
 * Aparece uma vez só, de propósito: a senha não fica guardada em lugar nenhum
 * de onde possa ser lida depois. Se o operador esquecer, o caminho é gerar
 * uma nova pelo botão "Redefinir senha".
 */
export const CredentialsCard: React.FC<CredentialsCardProps> = ({ credenciais, titulo, onFechar }) => {
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiarItem = async (chave: string, texto: string) => {
    const deuCerto = await copiar(texto);
    if (deuCerto) {
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 2000);
    } else {
      alert("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  };

  const BotaoCopiar: React.FC<{ chave: string; texto: string; titulo?: string }> = ({
    chave,
    texto,
    titulo: dica
  }) => (
    <button
      type="button"
      onClick={() => copiarItem(chave, texto)}
      title={dica || "Copiar"}
      className={`p-2 rounded-lg border transition-all shrink-0 ${
        copiado === chave
          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
          : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {copiado === chave ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const Linha: React.FC<{
    icone: React.ReactNode;
    rotulo: string;
    valor: string;
    chave: string;
    destaque?: boolean;
  }> = ({ icone, rotulo, valor, chave, destaque }) => (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
          {icone}
          {rotulo}
        </div>
        <div
          className={`truncate select-all ${
            destaque ? "font-mono text-base font-bold text-amber-300" : "text-sm text-white"
          }`}
        >
          {valor}
        </div>
      </div>
      <BotaoCopiar chave={chave} texto={valor} titulo={`Copiar ${rotulo.toLowerCase()}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">{titulo}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Envie estes dados para <strong className="text-slate-300">{credenciais.nome}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onFechar}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Copie a senha <strong>agora</strong>. Por segurança ela não fica guardada e não poderá ser
              consultada depois — se {credenciais.nome.split(" ")[0]} esquecer, use{" "}
              <strong>Redefinir senha</strong> para gerar uma nova.
            </p>
          </div>

          <Linha
            icone={<Globe className="w-3 h-3" />}
            rotulo="Site"
            valor={ENDERECO_DO_SISTEMA}
            chave="site"
          />
          <Linha
            icone={<Mail className="w-3 h-3" />}
            rotulo="E-mail de acesso"
            valor={credenciais.email}
            chave="email"
          />
          <Linha
            icone={<KeyRound className="w-3 h-3" />}
            rotulo="Senha"
            valor={credenciais.senha}
            chave="senha"
            destaque
          />

          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={() => copiarItem("mensagem", montarMensagem(credenciais))}
              className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border ${
                copiado === "mensagem"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : "bg-gradient-to-r from-brand-500 to-amber-500 border-transparent text-white hover:from-brand-600 hover:to-amber-600"
              }`}
            >
              {copiado === "mensagem" ? (
                <>
                  <Check className="w-4 h-4" /> Mensagem copiada
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar mensagem pronta para enviar
                </>
              )}
            </button>

            <a
              href={linkDoWhatsApp(credenciais)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              Abrir no WhatsApp
            </a>
          </div>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onFechar}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            Já enviei, fechar
          </button>
        </div>
      </div>
    </div>
  );
};

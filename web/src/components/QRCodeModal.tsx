import React, { useEffect, useState } from "react";
import { X, QrCode, Download, Printer, Copy, Check, User, Shirt, Award, Cpu, CreditCard, Calendar } from "lucide-react";
import QRCode from "qrcode";

interface QRCodeModalProps {
  athlete: {
    bib_number: string;
    name: string;
    chip: string;
    shirt?: string;
    modality?: string;
    category?: string;
    qr_code?: string;
    cpf?: string;
    birth_date?: string;
  } | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ athlete, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const qrValue = athlete?.qr_code || athlete?.bib_number || "";

  useEffect(() => {
    if (!athlete || !qrValue) return;

    QRCode.toDataURL(qrValue, {
      width: 320,
      margin: 2,
      color: {
        dark: "#050811",
        light: "#ffffff"
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Erro ao gerar QR Code:", err));
  }, [athlete, qrValue]);

  if (!athlete) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    // O modal rola junto com o fundo: em tela baixa (notebook, tablet do
    // balcão) o conteúdo passava do viewport e ficava cortado sem chance de
    // rolar, escondendo justamente o QR e os dados do atleta.
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-5 sm:p-8 max-w-md w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-5 sm:space-y-6 animate-scale-in text-slate-100 relative my-auto">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">
              QR Code do Atleta
            </h3>
            <p className="text-xs text-slate-400">
              Chave de Retirada & Identificação Rápida
            </p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center bg-white p-4 sm:p-6 rounded-2xl shadow-inner border border-slate-200">
          {qrDataUrl ? (
            <img 
              src={qrDataUrl} 
              alt={`QR Code - ${athlete.name}`} 
              className="w-40 h-40 sm:w-52 sm:h-52 object-contain"
            />
          ) : (
            <div className="w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center text-slate-400 text-xs">
              Gerando QR Code...
            </div>
          )}
          <span className="mt-2 text-xs font-mono font-bold text-slate-800 tracking-wider">
            {qrValue}
          </span>
        </div>

        {/* Informações Completas do Atleta */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Award className="w-3.5 h-3.5 text-brand-400" /> Número de Peito:
            </span>
            <span className="font-display font-black text-brand-400 text-sm">
              #{athlete.bib_number}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400" /> Nome:
            </span>
            <span className="font-bold text-white max-w-[200px] truncate text-right">
              {athlete.name}
            </span>
          </div>

          {athlete.cpf && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> CPF:
              </span>
              <span className="font-mono text-slate-300">
                {athlete.cpf}
              </span>
            </div>
          )}

          {athlete.birth_date && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Nascimento:
              </span>
              <span className="font-mono text-slate-300">
                {athlete.birth_date}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Shirt className="w-3.5 h-3.5 text-amber-400" /> Camiseta:
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono">
              {athlete.shirt || "Padrão"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Chip RFID / Modalidade:
            </span>
            <span className="font-mono text-emerald-400">
              {athlete.chip} ({athlete.modality || "Geral"})
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={copyToClipboard}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copiar Chave</span>
              </>
            )}
          </button>

          <a
            href={qrDataUrl}
            download={`qrcode-atleta-${athlete.bib_number}.png`}
            className="py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-brand-500/20 text-center"
          >
            <Download className="w-4 h-4" />
            <span>Baixar PNG</span>
          </a>
        </div>

      </div>
      </div>
    </div>
  );
};

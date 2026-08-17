import React, { useEffect, useState, useRef } from "react";
import { 
  Printer, 
  X, 
  CheckCircle2, 
  Award, 
  User, 
  Shirt, 
  Calendar, 
  CreditCard, 
  Cpu, 
  Clock, 
  QrCode,
  FileText,
  Download
} from "lucide-react";
import QRCode from "qrcode";
import { Participant } from "../types";

interface DeliveryReceiptModalProps {
  athlete: Participant | null;
  operatorName?: string;
  eventName?: string;
  onClose: () => void;
}

export const DeliveryReceiptModal: React.FC<DeliveryReceiptModalProps> = ({
  athlete,
  operatorName = "Operador Oficial",
  eventName = "CHIPOWER - Entrega Oficial de Kits",
  onClose
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const receiptRef = useRef<HTMLDivElement>(null);

  const qrValue = athlete?.qr_code || athlete?.bib_number || "";

  useEffect(() => {
    if (!athlete || !qrValue) return;

    QRCode.toDataURL(qrValue, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error("Erro ao gerar QR do recibo:", err));
  }, [athlete, qrValue]);

  if (!athlete) return null;

  const handlePrint = () => {
    window.print();
  };

  const deliveryDateFormatted = athlete.delivered_at 
    ? new Date(athlete.delivered_at).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR");

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Container Principal */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-6 animate-scale-in text-slate-100 relative print:border-none print:shadow-none print:bg-white print:text-black print:p-0 print:m-0 print:max-w-none">
        
        {/* Close Button (Hidden on Print) */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors print:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal (Hidden on Print) */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 print:hidden">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">
              Comprovante Oficial de Retirada
            </h3>
            <p className="text-xs text-slate-400">
              Recibo para conferência do atleta e auditoria do evento.
            </p>
          </div>
        </div>

        {/* ÁREA DE IMPRESSÃO (Formatada para Térmica 80mm e A4) */}
        <div 
          ref={receiptRef}
          className="bg-white text-slate-900 rounded-2xl p-6 sm:p-7 shadow-inner border border-slate-200 font-sans print:border-none print:p-2 print:shadow-none print:rounded-none"
        >
          {/* Cabeçalho do Comprovante */}
          <div className="text-center pb-4 border-b-2 border-dashed border-slate-300">
            <h2 className="font-display font-black text-xl tracking-tight text-slate-950 uppercase">
              {eventName}
            </h2>
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
              ✓ COMPROVANTE DE ENTREGA DE KIT
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Emitido em: {deliveryDateFormatted}
            </p>
          </div>

          {/* Destaque do Número de Peito */}
          <div className="my-4 text-center bg-slate-50 py-3.5 px-4 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
              NÚMERO DE PEITO OFICIAL
            </span>
            <span className="text-4xl font-black font-display text-slate-950 tracking-tight block">
              #{athlete.bib_number}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700 block mt-0.5">
              CHIP RFID: {athlete.chip}
            </span>
          </div>

          {/* Dados do Atleta */}
          <div className="space-y-2 text-xs py-2 border-b border-dashed border-slate-300">
            <div className="flex justify-between items-start">
              <span className="font-semibold text-slate-500">Atleta:</span>
              <strong className="text-right text-slate-950 font-bold max-w-[220px]">
                {athlete.name}
              </strong>
            </div>

            {athlete.cpf && (
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">CPF:</span>
                <span className="font-mono font-medium text-slate-800">{athlete.cpf}</span>
              </div>
            )}

            {athlete.birth_date && (
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Nascimento:</span>
                <span className="font-mono text-slate-800">{athlete.birth_date}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Modalidade:</span>
              <span className="font-bold text-slate-900">{athlete.modality || "Corrida Geral"}</span>
            </div>

            <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200/80">
              <span className="font-bold text-amber-900">Camiseta Entregue:</span>
              <span className="font-black text-sm text-amber-900 font-display">
                TAMANHO {athlete.shirt || "M"}
              </span>
            </div>
          </div>

          {/* Dados da Retirada e Auditoria */}
          <div className="space-y-1.5 text-xs py-3 border-b border-dashed border-slate-300 bg-slate-50/70 p-3 rounded-xl my-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Retirado Por:</span>
              <strong className="text-slate-950 font-bold">
                {athlete.receiver_name || athlete.name}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Operador:</span>
              <span className="text-slate-800">{operatorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data/Hora:</span>
              <span className="font-mono text-slate-800">{deliveryDateFormatted}</span>
            </div>
          </div>

          {/* QR Code & Validação */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase">
                Autenticação do Kit
              </p>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                Código: {qrValue}
              </p>
              <p className="text-[9px] text-emerald-700 font-bold mt-1">
                ✓ STATUS: ENTREGUE E AUDITADO
              </p>
            </div>
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl} 
                alt="QR Code Autenticação" 
                className="w-16 h-16 border border-slate-300 rounded p-1"
              />
            )}
          </div>

          {/* Canhoto de Assinatura */}
          <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-300 text-center">
            <div className="w-48 border-b border-slate-400 mx-auto mb-1"></div>
            <p className="text-[10px] text-slate-600 font-medium">
              Assinatura do Responsável pela Retirada
            </p>
          </div>
        </div>

        {/* Ações do Modal (Ocultas na Impressão) */}
        <div className="flex items-center justify-between gap-3 pt-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprovante / Recibo</span>
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Shirt, 
  Award, 
  User, 
  CreditCard, 
  Cpu, 
  Send, 
  RotateCcw, 
  Check, 
  Clock, 
  Sparkles,
  History,
  X,
  QrCode,
  Printer
} from "lucide-react";
import confetti from "canvas-confetti";
import { Participant, EventItem } from "../types";
import { api } from "../lib/appwrite";
import { sounds } from "../lib/audio";
import { QRCodeModal } from "./QRCodeModal";
import { DeliveryReceiptModal } from "./DeliveryReceiptModal";

interface DeliveryDeskProps {
  operatorName: string;
  onDeliveryComplete: () => void;
  recentDeliveries: Participant[];
  activeEvent?: EventItem | null;
}

export const DeliveryDesk: React.FC<DeliveryDeskProps> = ({
  operatorName,
  onDeliveryComplete,
  recentDeliveries,
  activeEvent = null
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Participant[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<Participant | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [isCustomReceiver, setIsCustomReceiver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [lastDelivered, setLastDelivered] = useState<Participant | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [receiptAthlete, setReceiptAthlete] = useState<Participant | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto focus no campo de busca ao carregar
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Atalho global: barra de espaço ou tecla '/' foca a busca, ESC limpa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      } else if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Busca instantânea com debounce
  useEffect(() => {
    const clean = searchTerm.trim();
    if (!clean) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.searchParticipants(clean, activeEvent ? activeEvent.$id : undefined);
        setSearchResults(results);

        // Se encontrou exatamente 1 resultado e o termo foi digitado por scanner ou busca exata
        if (results.length === 1 && (results[0].bib_number === clean || results[0].chip.toUpperCase() === clean.toUpperCase())) {
          selectAthlete(results[0]);
        }
      } catch (err) {
        console.error("Erro na busca:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, activeEvent?.$id]);

  const selectAthlete = (athlete: Participant) => {
    setSelectedAthlete(athlete);
    setReceiverName(athlete.name);
    setIsCustomReceiver(false);
    setSearchResults([]);

    if (athlete.delivered_at) {
      sounds.playWarning();
    }
  };

  const clearSelection = () => {
    setSelectedAthlete(null);
    setSearchTerm("");
    setSearchResults([]);
    setReceiverName("");
    setIsCustomReceiver(false);
    searchInputRef.current?.focus();
  };

  const handleConfirmDelivery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedAthlete || delivering) return;

    if (selectedAthlete.delivered_at) {
      if (!window.confirm("ATENÇÃO: Este atleta já consta como ENTREGUE no sistema. Deseja reconfirmar a entrega?")) {
        return;
      }
    }

    setDelivering(true);
    try {
      const finalReceiver = isCustomReceiver && receiverName.trim() ? receiverName.trim() : selectedAthlete.name;
      const res = await api.confirmDelivery(selectedAthlete, operatorName, finalReceiver);

      if (res.success) {
        // Efeito Sonoro + Confetti de Celebração
        sounds.playSuccess();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#f97316", "#10b981", "#3b82f6", "#eab308"]
        });

        setLastDelivered(res.participant);
        setReceiptAthlete(res.participant);
        onDeliveryComplete();
        clearSelection();
      }
    } catch (err) {
      console.error("Erro ao confirmar entrega:", err);
      alert("Falha ao registrar entrega no Appwrite. Verifique a conexão.");
    } finally {
      setDelivering(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* Coluna Principal: Balcão de Busca e Entrega */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Barra de Busca de Alta Performance */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 border border-slate-800 relative shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Busca Rápida de Atleta (RFID / Peito / Nome / CPF)
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              Dica: Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">/</kbd> para focar
            </span>
          </div>

          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o número de peito, nome do atleta, leia o chip ou CPF..."
              className="w-full pl-12 pr-12 py-3.5 bg-slate-950/90 border-2 border-slate-800 rounded-xl text-white placeholder-slate-500 text-base sm:text-lg font-medium focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 transition-all outline-none"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSearchResults([]);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Lista de Resultados da Busca */}
          {searchResults.length > 0 && !selectedAthlete && (
            <div className="mt-3 divide-y divide-slate-800/80 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl">
              {searchResults.map((athlete) => (
                <button
                  key={athlete.$id}
                  onClick={() => selectAthlete(athlete)}
                  className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center font-display font-black text-brand-400 text-lg group-hover:bg-brand-500 group-hover:text-white transition-all">
                      {athlete.bib_number}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base group-hover:text-brand-300">
                        {athlete.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{athlete.modality || "Geral"}</span>
                        <span>•</span>
                        <span>{athlete.category || "Geral"}</span>
                        {athlete.cpf && (
                          <>
                            <span>•</span>
                            <span>CPF: {athlete.cpf}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {athlete.shirt && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs">
                        {athlete.shirt}
                      </span>
                    )}
                    {athlete.delivered_at ? (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-500/30">
                        <Check className="w-3 h-3" /> Entregue
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30">
                        Pendente
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card de Detalhes do Atleta Selecionado */}
        {selectedAthlete ? (
          <div className="glass-card rounded-2xl p-6 border-2 border-slate-700/80 bg-slate-900/90 shadow-2xl relative overflow-hidden animate-fade-in">
            
            {/* Status Alert Banner */}
            {selectedAthlete.delivered_at ? (
              <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 mb-6 flex items-start justify-between gap-3 text-rose-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <h4 className="font-bold text-base text-rose-300">
                      ATENÇÃO: ESTE KIT JÁ FOI ENTREGUE!
                    </h4>
                    <p className="text-xs sm:text-sm text-rose-200/90 mt-1">
                      Entregue em: <strong className="font-mono text-white">{new Date(selectedAthlete.delivered_at).toLocaleString("pt-BR")}</strong>
                    </p>
                    <p className="text-xs text-rose-300/80 mt-0.5">
                      Retirado por: <strong className="text-white">{selectedAthlete.receiver_name || "Não informado"}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReceiptAthlete(selectedAthlete)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-lg shadow-rose-900/40"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Comprovante</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 mb-6 flex items-center justify-between text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm">KIT DISPONÍVEL PARA ENTREGA</span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  Pronto para retirada
                </span>
              </div>
            )}

            {/* Cabeçalho do Atleta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 flex flex-col items-center justify-center text-white shadow-xl shadow-brand-500/20 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Nº PEITO</span>
                  <span className="text-2xl sm:text-3xl font-black font-display tracking-tight">
                    {selectedAthlete.bib_number}
                  </span>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Atleta Inscrito
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {selectedAthlete.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-300">
                    {selectedAthlete.event_name && (
                      <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 font-semibold">
                        🏆 {selectedAthlete.event_name}
                      </span>
                    )}
                    {selectedAthlete.cpf && (
                      <span className="flex items-center gap-1 font-mono">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        {selectedAthlete.cpf}
                      </span>
                    )}
                    {selectedAthlete.birth_date && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Nasc: {selectedAthlete.birth_date} ({selectedAthlete.sex || "N/I"})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Destaque Principal: Tamanho da Camiseta */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-3 sm:p-0 rounded-xl bg-slate-950 sm:bg-transparent border sm:border-0 border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Shirt className="w-3.5 h-3.5 text-brand-400" /> Camiseta Oficial
                </span>
                <div className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-brand-500/20 border-2 border-amber-500/50 text-amber-300 font-black text-xl sm:text-2xl font-display shadow-lg shadow-amber-500/10">
                  {selectedAthlete.shirt || "NÃO ESPECIFICADO"}
                </div>
              </div>
            </div>

            {/* Grid de Metadados da Inscrição */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Modalidade</span>
                <span className="text-sm font-bold text-white mt-0.5 block truncate">
                  {selectedAthlete.modality || "Corrida Geral"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Categoria</span>
                <span className="text-sm font-bold text-white mt-0.5 block truncate">
                  {selectedAthlete.category || "Geral"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-emerald-400" /> Chip / EPC
                </span>
                <span className="text-xs font-mono text-emerald-400 mt-0.5 block truncate font-bold">
                  {selectedAthlete.chip || "---"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-brand-400" /> QR Code
                  </span>
                  <span className="text-xs font-mono text-brand-400 mt-0.5 block truncate font-bold">
                    {selectedAthlete.qr_code || selectedAthlete.bib_number}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-brand-500 text-brand-400 hover:text-brand-300 transition-all cursor-pointer"
                  title="Abrir e Imprimir QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Formulário de Confirmação de Retirada */}
            <div className="pt-4 border-t border-slate-800">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Quem está retirando o kit?
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomReceiver(false);
                        setReceiverName(selectedAthlete.name);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        !isCustomReceiver
                          ? "bg-brand-500 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      O Próprio Atleta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomReceiver(true);
                        setReceiverName("");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isCustomReceiver
                          ? "bg-brand-500 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Terceiro / Procurador
                    </button>
                  </div>
                </div>

                {isCustomReceiver && (
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Nome completo do responsável pela retirada (ex: Pai, Amigo)..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-brand-500"
                    autoFocus
                  />
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Cancelar (ESC)
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmDelivery()}
                  disabled={delivering}
                  className={`w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold font-display text-base transition-all flex items-center justify-center gap-2 shadow-xl ${
                    selectedAthlete.delivered_at
                      ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30"
                      : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-500/30 glow-emerald"
                  }`}
                >
                  {delivering ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Gravando Entrega no Appwrite...
                    </>
                  ) : selectedAthlete.delivered_at ? (
                    <>
                      <AlertTriangle className="w-5 h-5" /> RECONFIRMAR ENTREGA DO KIT
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" /> CONFIRMAR ENTREGA DO KIT (ENTER)
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* Estado Vazio de Espera */
          <div className="glass-card rounded-2xl p-12 border border-slate-800/80 text-center flex flex-col items-center justify-center min-h-[320px]">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">
              Aguardando Leitura ou Pesquisa
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              Aproxime a tag RFID no leitor, passe o código de barras ou digite o número de peito/nome do atleta acima.
            </p>
          </div>
        )}

        {/* Última entrega com sucesso (Feedback Toast) */}
        {lastDelivered && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-emerald-200 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                ✓
              </div>
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider block">
                  Última Entrega Confirmada com Sucesso!
                </span>
                <span className="font-bold text-white text-sm">
                  #{lastDelivered.bib_number} - {lastDelivered.name}
                </span>
                <span className="text-xs text-slate-400 block">
                  Camiseta: {lastDelivered.shirt || "Padrão"} • Retirado por: {lastDelivered.receiver_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReceiptAthlete(lastDelivered)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Recibo</span>
              </button>
              <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
          </div>
        )}

      </div>

      {/* Coluna Lateral: Feed de Entregas Recentes do Balcão */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" />
              Últimas Entregas Realizadas
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Tempo Real
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-800/60 max-h-[520px] overflow-y-auto pr-1">
            {recentDeliveries.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Nenhuma entrega registrada ainda.
              </p>
            ) : (
              recentDeliveries.map((delivery) => (
                <div key={delivery.$id} className="py-3 flex items-center justify-between gap-2 group">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-display font-black text-emerald-400 text-xs shrink-0">
                      {delivery.bib_number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[150px]">
                        {delivery.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Camiseta: <strong className="text-amber-400">{delivery.shirt || "-"}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReceiptAthlete(delivery)}
                      title="Imprimir Comprovante de Retirada"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                        OK
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de QR Code do Atleta Selecionado */}
      {isQrModalOpen && selectedAthlete && (
        <QRCodeModal
          athlete={selectedAthlete}
          onClose={() => setIsQrModalOpen(false)}
        />
      )}

      {/* Modal de Comprovante / Recibo de Entrega */}
      {receiptAthlete && (
        <DeliveryReceiptModal
          athlete={receiptAthlete}
          operatorName={operatorName}
          onClose={() => setReceiptAthlete(null)}
        />
      )}

    </div>
  );
};

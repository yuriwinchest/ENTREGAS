import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  User, 
  Award, 
  Cpu, 
  Shirt, 
  CreditCard, 
  Calendar, 
  QrCode, 
  Activity, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  AlertCircle
} from "lucide-react";
import { Participant } from "../types";
import { api } from "../lib/appwrite";

interface EditAthleteModalProps {
  athlete: Participant | null;
  onClose: () => void;
  onSaved: (updated: Participant) => void;
}

export const EditAthleteModal: React.FC<EditAthleteModalProps> = ({
  athlete,
  onClose,
  onSaved
}) => {
  if (!athlete) return null;

  const [formData, setFormData] = useState({
    bib_number: athlete.bib_number || "",
    chip: athlete.chip || "",
    name: athlete.name || "",
    cpf: athlete.cpf || "",
    birth_date: athlete.birth_date || "",
    sex: athlete.sex || "M",
    shirt: athlete.shirt || "M",
    modality: athlete.modality || "Geral",
    category: athlete.category || "Geral",
    qr_code: athlete.qr_code || athlete.bib_number || "",
    delivered: !!athlete.delivered_at,
    receiver_name: athlete.receiver_name || ""
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bib_number.trim() || !formData.name.trim()) {
      setError("Número de Peito e Nome são campos obrigatórios.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Partial<Participant> = {
        bib_number: formData.bib_number.trim(),
        chip: (formData.chip.trim() || formData.bib_number.trim()).toUpperCase(),
        name: formData.name.trim().toUpperCase(),
        cpf: formData.cpf.trim() || undefined,
        birth_date: formData.birth_date.trim() || undefined,
        sex: formData.sex.trim().toUpperCase(),
        shirt: formData.shirt.trim().toUpperCase(),
        modality: formData.modality.trim(),
        category: formData.category.trim(),
        qr_code: formData.qr_code.trim() || formData.bib_number.trim()
      };

      // Gerenciar status de entrega
      if (!formData.delivered) {
        payload.delivered_at = null;
        payload.receiver_name = null;
      } else if (!athlete.delivered_at && formData.delivered) {
        payload.delivered_at = new Date().toISOString();
        payload.receiver_name = formData.receiver_name.trim() || formData.name.trim();
      } else if (formData.delivered && formData.receiver_name) {
        payload.receiver_name = formData.receiver_name.trim();
      }

      const updated = await api.updateParticipant(athlete.$id, payload);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar atleta:", err);
      setError(err?.message || "Falha ao salvar alterações no banco de dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-6 animate-scale-in text-slate-100 relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-3 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white font-display">
              Editar Dados do Atleta
            </h3>
            <p className="text-xs text-slate-400">
              Modifique informações cadastrais, chip RFID, tamanho de camisa ou status de entrega.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Linha 1: Numero de Peito & Chip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-brand-400" /> Número de Peito *
              </label>
              <input
                type="text"
                required
                value={formData.bib_number}
                onChange={(e) => setFormData({ ...formData, bib_number: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-display font-black text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Código do Chip / EPC
              </label>
              <input
                type="text"
                value={formData.chip}
                onChange={(e) => setFormData({ ...formData, chip: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 uppercase"
              />
            </div>
          </div>

          {/* Linha 2: Nome Completo */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> Nome Completo do Atleta *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 uppercase"
            />
          </div>

          {/* Linha 3: CPF & Data de Nascimento & Sexo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> CPF
              </label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Nascimento
              </label>
              <input
                type="text"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                placeholder="DD/MM/AAAA"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Sexo</label>
              <select
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-brand-500"
              >
                <option value="M">Masculino (M)</option>
                <option value="F">Feminino (F)</option>
                <option value="O">Outro</option>
              </select>
            </div>
          </div>

          {/* Linha 4: Camisa & Modalidade & Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-amber-400" /> Camiseta
              </label>
              <input
                type="text"
                value={formData.shirt}
                onChange={(e) => setFormData({ ...formData, shirt: e.target.value })}
                placeholder="P, M, G, GG..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-bold font-mono outline-none focus:border-brand-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-slate-400" /> Modalidade
              </label>
              <input
                type="text"
                value={formData.modality}
                onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                placeholder="5KM, 10KM, Caminhada..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Categoria</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Geral, Faixa Etária..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Linha 5: QR Code */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-brand-400" /> Código / Chave QR Code
            </label>
            <input
              type="text"
              value={formData.qr_code}
              onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-brand-300 font-mono outline-none focus:border-brand-500"
            />
          </div>

          {/* Linha 6: Status de Entrega */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                {formData.delivered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
                Status de Entrega do Kit
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, delivered: false, receiver_name: "" })}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    !formData.delivered
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Pendente
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, delivered: true, receiver_name: formData.receiver_name || formData.name })}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    formData.delivered
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Entregue
                </button>
              </div>
            </div>

            {formData.delivered && (
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Nome do Responsável que Retirou o Kit:
                </label>
                <input
                  type="text"
                  value={formData.receiver_name}
                  onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                  placeholder="Nome de quem retirou..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-brand-500"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Settings, Save, Radio, Server, Check, AlertCircle } from "lucide-react";
import { EventSettings } from "../types";
import { api } from "../lib/appwrite";

interface SettingsModalProps {
  settings: EventSettings;
  onSave: (newSettings: EventSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<EventSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      const updated = await api.updateSettings(formData.$id, {
        event_name: formData.event_name,
        reader_ip: formData.reader_ip,
        banner_url: formData.banner_url,
        active: formData.active
      });
      onSave(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      alert("Falha ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" />
          Configurações da Operação
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Ajustes de evento, leitor RFID e sincronização em nuvem.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
        
        {/* Nome do Evento */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
            Nome Oficial do Evento
          </label>
          <input
            type="text"
            value={formData.event_name}
            onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
            placeholder="Ex: 5ª Corrida da Independência 2026"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-brand-500"
            required
          />
        </div>

        {/* IP do Leitor RFID */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-brand-400" />
            Endereço IP do Leitor RFID (Pórtico / Mesa)
          </label>
          <input
            type="text"
            value={formData.reader_ip || ""}
            onChange={(e) => setFormData({ ...formData, reader_ip: e.target.value })}
            placeholder="Ex: 192.168.0.33"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono outline-none focus:border-brand-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Endereço IP do leitor Impinj/Chafon/UHF na rede local.
          </p>
        </div>

        {/* Informações da Nuvem Appwrite */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
            <Server className="w-4 h-4 text-emerald-400" /> Banco de Dados em Nuvem (Appwrite)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-400">
            <div>Endpoint: <strong className="text-slate-200">db.largadabrasil.com</strong></div>
            <div>Database: <strong className="text-brand-400">chipower_entregas</strong></div>
            <div>Domínio Web: <strong className="text-slate-200">entregaschipower.com</strong></div>
            <div>Status: <strong className="text-emerald-400">Ativo / Conectado</strong></div>
          </div>
        </div>

        {/* Feedback de Sucesso */}
        {savedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> Configurações atualizadas na nuvem com sucesso!
          </div>
        )}

        {/* Botão de Salvar */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>

      </form>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { DeliveryDesk } from "./components/DeliveryDesk";
import { LiveScreen } from "./components/LiveScreen";
import { ParticipantsManager } from "./components/ParticipantsManager";
import { SettingsModal } from "./components/SettingsModal";
import { Participant, EventSettings, DeliveryStats } from "./types";
import { api, client, DATABASE_ID, COLLECTIONS } from "./lib/appwrite";

export function App() {
  // Roteamento simples por tab ou path
  const [currentTab, setCurrentTab] = useState<"desk" | "telao" | "participants" | "settings">("desk");
  const [operatorName, setOperatorName] = useState<string>("Balcão 1");
  const [online, setOnline] = useState<boolean>(true);

  // Estados Globais
  const [stats, setStats] = useState<DeliveryStats>({
    total: 0,
    delivered: 0,
    pending: 0,
    percentage: 0,
    deliveriesLastHour: 0
  });
  const [recentDeliveries, setRecentDeliveries] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<EventSettings>({
    $id: "default",
    event_name: "CHIPOWER - Entrega Oficial de Kits",
    reader_ip: "192.168.0.33",
    banner_url: "",
    active: true
  });

  // Carregar operador do localStorage e checar rota /telao
  useEffect(() => {
    const saved = localStorage.getItem("chipower_operator");
    if (saved) setOperatorName(saved);

    if (window.location.pathname.includes("/telao") || window.location.hash.includes("telao")) {
      setCurrentTab("telao");
    }
  }, []);

  // Carregar dados iniciais
  const refreshData = async () => {
    try {
      const [s, rec, set] = await Promise.all([
        api.getStats(),
        api.getRecentDeliveries(10),
        api.getSettings()
      ]);
      setStats(s);
      setRecentDeliveries(rec);
      setSettings(set);
      setOnline(true);
    } catch (err) {
      console.error("Erro ao sincronizar com Appwrite:", err);
      setOnline(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Polling inteligente a cada 4s para sincronização contínua
    const interval = setInterval(refreshData, 4000);

    // Inscrição Realtime no Appwrite para push instantâneo
    try {
      const unsubscribe = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.PARTICIPANTS}.documents`,
        () => {
          refreshData();
        }
      );
      return () => {
        clearInterval(interval);
        unsubscribe();
      };
    } catch {
      return () => clearInterval(interval);
    }
  }, []);

  // Telão TV Fullscreen
  if (currentTab === "telao") {
    return (
      <div className="relative">
        <LiveScreen
          eventName={settings.event_name}
          stats={stats}
          recentDeliveries={recentDeliveries}
          onExit={() => setCurrentTab("desk")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        eventName={settings.event_name}
        operatorName={operatorName}
        setOperatorName={setOperatorName}
        online={online}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top KPIs Summary */}
        <StatsCards stats={stats} />

        {/* Tab Views */}
        {currentTab === "desk" && (
          <DeliveryDesk
            operatorName={operatorName}
            onDeliveryComplete={refreshData}
            recentDeliveries={recentDeliveries}
          />
        )}

        {currentTab === "participants" && (
          <ParticipantsManager />
        )}

        {currentTab === "settings" && (
          <SettingsModal
            settings={settings}
            onSave={(newSet) => setSettings(newSet)}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 bg-navy-950 text-center text-xs text-slate-500 font-mono">
        CHIPOWER Kits Cloud Platform • Sincronização Segura Appwrite • Powered by CHIPOWER Engine
      </footer>
    </div>
  );
}

export default App;

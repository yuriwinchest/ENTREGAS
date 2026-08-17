import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { DeliveryDesk } from "./components/DeliveryDesk";
import { LiveScreen } from "./components/LiveScreen";
import { ParticipantsManager } from "./components/ParticipantsManager";
import { SettingsModal } from "./components/SettingsModal";
import { LoginScreen } from "./components/LoginScreen";
import { EventManagerModal } from "./components/EventManagerModal";
import { Participant, EventSettings, DeliveryStats, EventItem } from "./types";
import { api, client, auth, DATABASE_ID, COLLECTIONS } from "./lib/appwrite";
import { Models } from "appwrite";
import { Zap, Loader2 } from "lucide-react";

export function App() {
  // Roteamento simples por tab ou path
  const [currentTab, setCurrentTab] = useState<"desk" | "telao" | "participants" | "settings">("desk");
  const [operatorName, setOperatorName] = useState<string>("Aline Pedrosa");
  const [online, setOnline] = useState<boolean>(true);
  
  // Estado de Autenticação
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Estados Globais de Eventos / Tabelas
  const [events, setEvents] = useState<EventItem[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);

  // Estados Globais de Dados
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

  // Verificar sessão inicial no Appwrite
  useEffect(() => {
    const checkInitialSession = async () => {
      try {
        const currentUser = await auth.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setOperatorName(currentUser.name || "Aline Pedrosa");
        }
      } catch (err) {
        console.warn("Sem sessão prévia:", err);
      } finally {
        setAuthChecking(false);
      }
    };

    checkInitialSession();

    if (window.location.pathname.includes("/telao") || window.location.hash.includes("telao")) {
      setCurrentTab("telao");
    }
  }, []);

  // Carregar lista de eventos / tabelas
  const loadEvents = async () => {
    try {
      const list = await api.listEvents();
      setEvents(list);
      // Se não tem evento ativo e existem eventos cadastrados, ativa o primeiro mais recente
      setActiveEvent((prev) => {
        if (!prev && list.length > 0) return list[0];
        if (prev) {
          const updated = list.find((e) => e.$id === prev.$id);
          return updated || null;
        }
        return null;
      });
    } catch (err) {
      console.error("Erro ao carregar eventos:", err);
    }
  };

  // Carregar dados da nuvem (estatísticas segregadas pelo evento ativo)
  const refreshData = async () => {
    try {
      const activeId = activeEvent ? activeEvent.$id : undefined;
      const [s, rec, set] = await Promise.all([
        api.getStats(activeId),
        api.getRecentDeliveries(10, activeId),
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
    // Sincroniza dados da nuvem apenas se houver usuário autenticado ou no modo Telão
    if (!user && currentTab !== "telao") return;

    loadEvents();
    refreshData();

    // Polling inteligente a cada 4s para sincronização contínua
    const interval = setInterval(() => {
      refreshData();
    }, 4000);

    // Inscrição Realtime no Appwrite para push instantâneo
    try {
      const unsubscribe = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.PARTICIPANTS}.documents`,
        () => {
          refreshData();
          loadEvents();
        }
      );
      return () => {
        clearInterval(interval);
        unsubscribe();
      };
    } catch {
      return () => clearInterval(interval);
    }
  }, [user, currentTab, activeEvent]);

  // Logout
  const handleLogout = async () => {
    await auth.logout();
    setUser(null);
  };

  // Carregamento Inicial Ultrarrápido de Sessão
  if (authChecking) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center font-sans select-none">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-4 animate-pulse">
          <Zap className="w-9 h-9 text-white fill-white" />
        </div>
        <div className="flex items-center gap-2.5 text-brand-400 font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          <span>Iniciando CHIPOWER Cloud...</span>
        </div>
      </div>
    );
  }

  // Telão TV Fullscreen (Acessível logado ou diretamente pelo Telão)
  if (currentTab === "telao") {
    return (
      <div className="relative">
        <LiveScreen
          eventName={activeEvent ? activeEvent.name : settings.event_name}
          stats={stats}
          recentDeliveries={recentDeliveries}
          onExit={() => setCurrentTab("desk")}
        />
      </div>
    );
  }

  // Se não estiver logado, exibe a Tela de Login
  if (!user) {
    return (
      <LoginScreen
        onLoginSuccess={(loggedUser) => {
          setUser(loggedUser);
          setOperatorName(loggedUser.name || "Aline Pedrosa");
        }}
        onOpenTelao={() => setCurrentTab("telao")}
      />
    );
  }

  // Painel Principal Operacional Autenticado
  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        eventName={activeEvent ? activeEvent.name : settings.event_name}
        operatorName={operatorName}
        setOperatorName={setOperatorName}
        online={online}
        onLogout={handleLogout}
        events={events}
        activeEvent={activeEvent}
        onSelectEvent={(ev) => {
          setActiveEvent(ev);
        }}
        onOpenEventManager={() => setIsEventManagerOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top KPIs Summary (Segregados pelo Evento Ativo) */}
        <StatsCards 
          stats={stats} 
          activeEventName={activeEvent ? activeEvent.name : null}
        />

        {/* Tab Views */}
        {currentTab === "desk" && (
          <DeliveryDesk
            operatorName={operatorName}
            onDeliveryComplete={refreshData}
            recentDeliveries={recentDeliveries}
            activeEvent={activeEvent}
          />
        )}

        {currentTab === "participants" && (
          <ParticipantsManager
            events={events}
            activeEvent={activeEvent}
            onSelectEvent={(ev) => setActiveEvent(ev)}
            onRefreshEvents={() => {
              loadEvents();
              refreshData();
            }}
          />
        )}

        {currentTab === "settings" && (
          <SettingsModal
            settings={settings}
            onSave={(newSet) => setSettings(newSet)}
          />
        )}

      </main>

      {/* Modal de Gestão de Eventos / Tabelas */}
      {isEventManagerOpen && (
        <EventManagerModal
          events={events}
          activeEventId={activeEvent?.$id || null}
          onSelectEvent={(ev) => {
            setActiveEvent(ev);
            setIsEventManagerOpen(false);
          }}
          onRefreshEvents={() => {
            loadEvents();
            refreshData();
          }}
          onClose={() => setIsEventManagerOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 bg-navy-950 text-center text-xs text-slate-500 font-mono">
        CHIPOWER Kits Cloud Platform • Evento Ativo: <strong className="text-slate-300">{activeEvent ? activeEvent.name : "Visão Geral (Todos os Eventos)"}</strong> • Operador: <strong className="text-slate-400">{operatorName}</strong> ({user.email})
      </footer>
    </div>
  );
}

export default App;

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Models } from "appwrite";
import { Loader2, Zap } from "lucide-react";

import { Header } from "./Header";
import { EventTabsBar } from "./EventTabsBar";
import { StatsCards } from "./StatsCards";
import { DeliveryDesk } from "./DeliveryDesk";
import { LiveScreen } from "./LiveScreen";
import { ParticipantsManager } from "./ParticipantsManager";
import { SettingsModal } from "./SettingsModal";
import { EventManagerModal } from "./EventManagerModal";
import { UserManagerModal } from "./users/UserManagerModal";
import { ImportWizardModal } from "./ImportWizardModal";
import { AccessDenied } from "./AccessDenied";

import { Participant, EventSettings, DeliveryStats, EventItem, documentoVazio } from "../types";
import { api, setVisibleEventIds } from "../lib/appwrite";
import { useSession } from "../lib/session";
import { PermissionKey } from "../lib/permissions";
import { useLiveSync } from "../hooks/useLiveSync";

export type AppTab = "desk" | "telao" | "participants" | "settings";

const PERMISSAO_DA_ABA: Record<AppTab, PermissionKey> = {
  desk: "tab.desk",
  telao: "tab.telao",
  participants: "tab.participants",
  settings: "tab.settings"
};

const ORDEM_DE_FALLBACK: AppTab[] = ["desk", "participants", "telao", "settings"];

const ESTATISTICAS_ZERADAS: DeliveryStats = {
  total: 0,
  delivered: 0,
  pending: 0,
  percentage: 0,
  deliveriesLastHour: 0
};

const CONFIGURACAO_PADRAO: EventSettings = {
  ...documentoVazio("default"),
  event_name: "CHIPOWER - Entrega Oficial de Kits",
  reader_ip: "192.168.0.33",
  banner_url: "",
  active: true
};

interface WorkspaceProps {
  user: Models.User<Models.Preferences>;
  onLogout: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ user, onLogout }) => {
  const { session, loading, error, can, reload } = useSession();

  const [currentTab, setCurrentTab] = useState<AppTab>("desk");
  const [operatorName, setOperatorName] = useState<string>(user.name || "Operador");
  const [online, setOnline] = useState(true);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);

  const [stats, setStats] = useState<DeliveryStats>(ESTATISTICAS_ZERADAS);
  const [recentDeliveries, setRecentDeliveries] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<EventSettings>(CONFIGURACAO_PADRAO);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importWorkbook, setImportWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // O evento ativo vive por id; o objeto é derivado para não gerar re-render em cascata.
  const activeEvent = useMemo(
    () => (activeEventId ? events.find((e) => e.$id === activeEventId) || null : null),
    [events, activeEventId]
  );

  // O id atual precisa estar acessível dentro do refresh sem recriar a assinatura.
  const eventoAtivoRef = useRef<string | null>(null);
  eventoAtivoRef.current = activeEventId;

  const abasPermitidas = useMemo(
    () => (Object.keys(PERMISSAO_DA_ABA) as AppTab[]).filter((tab) => can(PERMISSAO_DA_ABA[tab])),
    [can]
  );

  // Garante que o usuário nunca fique numa aba que ele não pode abrir.
  useEffect(() => {
    if (!session?.provisioned || abasPermitidas.length === 0) return;
    if (abasPermitidas.includes(currentTab)) return;

    const destino = ORDEM_DE_FALLBACK.find((tab) => abasPermitidas.includes(tab));
    if (destino) setCurrentTab(destino);
  }, [abasPermitidas, currentTab, session?.provisioned]);

  /** Recarrega tudo que a tela mostra, sempre no escopo do evento ativo. */
  const sincronizar = useCallback(async () => {
    const eventoAtivo = eventoAtivoRef.current;

    try {
      const [listaEventos, estatisticas, recentes, configuracao] = await Promise.all([
        api.listEvents(),
        api.getStats(eventoAtivo),
        api.getRecentDeliveries(10, eventoAtivo),
        api.getSettings()
      ]);

      setEvents(listaEventos);
      setVisibleEventIds(listaEventos.map((ev) => ev.$id));

      setActiveEventId((anterior) => {
        if (anterior && listaEventos.some((e) => e.$id === anterior)) return anterior;
        return listaEventos.length > 0 ? listaEventos[0].$id : null;
      });

      setStats(estatisticas);
      setRecentDeliveries(recentes);
      setSettings(configuracao);
      setOnline(true);
    } catch (err) {
      console.error("Erro ao sincronizar com o Appwrite:", err);
      setOnline(false);
    }
  }, []);

  const { refreshNow } = useLiveSync({
    enabled: Boolean(session?.provisioned),
    refresh: sincronizar
  });

  // Trocar de evento recarrega os números na hora, sem esperar o próximo ciclo.
  useEffect(() => {
    if (session?.provisioned) void refreshNow();
  }, [activeEventId, session?.provisioned, refreshNow]);

  const abrirSeletorDeArquivo = () => fileInputRef.current?.click();

  const aoEscolherArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = (evt) => {
      try {
        const dados = new Uint8Array(evt.target?.result as ArrayBuffer);
        const planilha = XLSX.read(dados, { type: "array", cellDates: true });

        if (!planilha.SheetNames?.length) {
          alert("O arquivo não possui planilhas legíveis.");
          return;
        }

        setImportWorkbook(planilha);
        setImportFileName(arquivo.name);
        setIsImportModalOpen(true);
      } catch (err) {
        console.error("Erro ao ler arquivo:", err);
        alert("Não foi possível ler o arquivo. Use um Excel (.xlsx, .xls) ou CSV válido.");
      }
    };
    leitor.readAsArrayBuffer(arquivo);
  };

  const fecharImportacao = () => {
    setIsImportModalOpen(false);
    setImportWorkbook(null);
    setImportFileName("");
  };

  // -------------------------------------------------------------------------
  // Estados de borda: carregando permissões, conta sem ambiente, erro
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-4 animate-pulse">
          <Zap className="w-9 h-9 text-white fill-white" />
        </div>
        <div className="flex items-center gap-2.5 text-brand-400 font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          <span>Carregando seu ambiente...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <AccessDenied
        titulo="Não foi possível abrir seu ambiente"
        mensagem="Houve uma falha ao consultar suas permissões no servidor."
        detalhe={error}
        onRetry={reload}
        onLogout={onLogout}
      />
    );
  }

  if (!session?.provisioned) {
    return (
      <AccessDenied
        titulo="Conta ainda sem ambiente"
        mensagem="Seu acesso existe, mas ainda não foi vinculado a um ambiente de trabalho. Peça ao administrador para liberar o seu usuário na tela de Gestão de Equipe."
        detalhe={user.email}
        onRetry={reload}
        onLogout={onLogout}
      />
    );
  }

  if (abasPermitidas.length === 0) {
    return (
      <AccessDenied
        titulo="Nenhuma área liberada"
        mensagem="Seu usuário está ativo, mas o administrador ainda não liberou nenhuma área do sistema para você."
        detalhe={user.email}
        onRetry={reload}
        onLogout={onLogout}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Telão em tela cheia
  // -------------------------------------------------------------------------

  if (currentTab === "telao") {
    return (
      <LiveScreen
        eventName={activeEvent ? activeEvent.name : settings.event_name}
        stats={stats}
        recentDeliveries={recentDeliveries}
        onExit={() => setCurrentTab(abasPermitidas.find((t) => t !== "telao") || "telao")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      <input
        type="file"
        ref={fileInputRef}
        onChange={aoEscolherArquivo}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        allowedTabs={abasPermitidas}
        eventName={activeEvent ? activeEvent.name : settings.event_name}
        operatorName={operatorName}
        setOperatorName={setOperatorName}
        online={online}
        onLogout={onLogout}
        onOpenUserManager={can("team.manage") ? () => setIsUserManagerOpen(true) : undefined}
        events={events}
        activeEvent={activeEvent}
        onSelectEvent={(ev) => setActiveEventId(ev ? ev.$id : null)}
        onOpenEventManager={can("event.edit") ? () => setIsEventManagerOpen(true) : undefined}
        tenantName={session.tenant?.name}
        roleLabel={session.operator?.role === "admin" ? "Administrador" : "Operador"}
      />

      <EventTabsBar
        events={events}
        activeEvent={activeEvent}
        onSelectEvent={(ev) => setActiveEventId(ev ? ev.$id : null)}
        onOpenEventManager={can("event.edit") ? () => setIsEventManagerOpen(true) : undefined}
        onOpenImportModal={can("athlete.import") ? abrirSeletorDeArquivo : undefined}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <StatsCards stats={stats} activeEventName={activeEvent ? activeEvent.name : null} />

        {currentTab === "desk" && (
          <DeliveryDesk
            operatorName={operatorName}
            onDeliveryComplete={refreshNow}
            recentDeliveries={recentDeliveries}
            activeEvent={activeEvent}
          />
        )}

        {currentTab === "participants" && (
          <ParticipantsManager
            events={events}
            activeEvent={activeEvent}
            onSelectEvent={(ev) => setActiveEventId(ev ? ev.$id : null)}
            onRefreshEvents={refreshNow}
          />
        )}

        {currentTab === "settings" && (
          <SettingsModal settings={settings} onSave={(novo) => setSettings(novo)} />
        )}
      </main>

      {isEventManagerOpen && (
        <EventManagerModal
          events={events}
          activeEventId={activeEventId}
          onSelectEvent={(ev) => {
            setActiveEventId(ev ? ev.$id : null);
            setIsEventManagerOpen(false);
          }}
          onRefreshEvents={refreshNow}
          onClose={() => setIsEventManagerOpen(false)}
        />
      )}

      {isUserManagerOpen && <UserManagerModal onClose={() => setIsUserManagerOpen(false)} />}

      {isImportModalOpen && importWorkbook && (
        <ImportWizardModal
          workbook={importWorkbook}
          fileName={importFileName}
          existingEvents={events}
          activeEventId={activeEventId}
          onClose={fecharImportacao}
          onSuccess={(novoEvento) => {
            fecharImportacao();
            if (novoEvento) setActiveEventId(novoEvento.$id);
            void refreshNow();
          }}
        />
      )}

      <footer className="border-t border-slate-900 py-4 bg-navy-950 text-center text-xs text-slate-500 font-mono">
        {session.tenant?.name} • Evento Ativo:{" "}
        <strong className="text-slate-300">
          {activeEvent ? activeEvent.name : "Visão Geral (Todas as Tabelas)"}
        </strong>{" "}
        • Operador: <strong className="text-slate-400">{operatorName}</strong> ({user.email})
      </footer>
    </div>
  );
};

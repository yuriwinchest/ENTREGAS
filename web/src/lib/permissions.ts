/**
 * Catálogo de permissões do CHIPOWER.
 *
 * Espelho de `functions/admin-api/src/permissions.js`. Aqui é só apresentação:
 * quem realmente decide o que cada usuário pode fazer é o servidor.
 */

export type PermissionKey =
  | "tab.desk"
  | "tab.telao"
  | "tab.participants"
  | "tab.settings"
  | "event.create"
  | "event.edit"
  | "event.delete"
  | "event.view_all"
  | "athlete.import"
  | "athlete.export"
  | "athlete.edit"
  | "athlete.delete"
  | "data.purge"
  | "data.reset"
  | "delivery.confirm"
  | "team.manage";

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  group: "Áreas do sistema" | "Eventos e tabelas" | "Atletas" | "Operação" | "Administração";
  adminOnly?: boolean;
  destructive?: boolean;
}

export const PERMISSIONS: PermissionDefinition[] = [
  {
    key: "tab.desk",
    label: "Balcão de Entrega",
    description: "Acessa a tela de leitura de chip e entrega de kits",
    group: "Áreas do sistema"
  },
  {
    key: "tab.telao",
    label: "Telão TV",
    description: "Abre o painel de exibição da tenda em tela cheia",
    group: "Áreas do sistema"
  },
  {
    key: "tab.participants",
    label: "Atletas & Tabelas",
    description: "Consulta a base de atletas do ambiente",
    group: "Áreas do sistema"
  },
  {
    key: "tab.settings",
    label: "Configurações",
    description: "Altera parâmetros gerais do evento e da leitora RFID",
    group: "Áreas do sistema",
    adminOnly: true
  },

  {
    key: "event.create",
    label: "Criar eventos / tabelas",
    description: "Cadastra novas provas no ambiente",
    group: "Eventos e tabelas"
  },
  {
    key: "event.edit",
    label: "Editar eventos",
    description: "Renomeia e ajusta data, local e descrição das provas",
    group: "Eventos e tabelas"
  },
  {
    key: "event.delete",
    label: "Excluir eventos",
    description: "Remove uma prova inteira junto com os atletas dela",
    group: "Eventos e tabelas",
    destructive: true
  },
  {
    key: "event.view_all",
    label: "Ver tabelas de toda a equipe",
    description: "Sem esta permissão o usuário enxerga apenas as tabelas que ele mesmo anexou",
    group: "Eventos e tabelas",
    adminOnly: true
  },

  {
    key: "athlete.import",
    label: "Anexar planilha",
    description: "Importa atletas via Excel ou CSV",
    group: "Atletas"
  },
  {
    key: "athlete.export",
    label: "Exportar relatório",
    description: "Baixa a planilha de conferência das entregas",
    group: "Atletas"
  },
  {
    key: "athlete.edit",
    label: "Editar atleta",
    description: "Corrige dados cadastrais de um inscrito",
    group: "Atletas"
  },
  {
    key: "athlete.delete",
    label: "Excluir atleta",
    description: "Remove um inscrito individualmente",
    group: "Atletas",
    destructive: true
  },

  {
    key: "delivery.confirm",
    label: "Confirmar entrega de kit",
    description: "Registra a retirada do kit pelo atleta",
    group: "Operação"
  },
  {
    key: "data.reset",
    label: "Resetar entregas",
    description: "Devolve todos os kits do evento para o status pendente",
    group: "Operação",
    destructive: true
  },
  {
    key: "data.purge",
    label: "Limpar base de atletas",
    description: "Exclui em massa os inscritos do evento",
    group: "Operação",
    destructive: true
  },

  {
    key: "team.manage",
    label: "Gestão de equipe",
    description: "Cria usuários e define o que cada um pode acessar",
    group: "Administração",
    adminOnly: true
  }
];

export const PERMISSION_GROUPS = [
  "Áreas do sistema",
  "Eventos e tabelas",
  "Atletas",
  "Operação",
  "Administração"
] as const;

export const ADMIN_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

/**
 * O que um operador de balcão recebe por padrão.
 *
 * É o mínimo para trabalhar a fila: abrir o balcão, pesquisar o atleta,
 * confirmar a entrega e anexar a planilha do evento dele. Configurações,
 * gestão de equipe, exclusão em massa e reset ficam fora — a Aline concede
 * caso a caso na matriz de permissões.
 */
export const DEFAULT_OPERATOR_PERMISSIONS: PermissionKey[] = [
  "tab.desk",
  "delivery.confirm",
  "tab.participants",
  "athlete.import"
];

export const permissionsByGroup = (group: string) => PERMISSIONS.filter((p) => p.group === group);

export const findPermission = (key: string) => PERMISSIONS.find((p) => p.key === key);

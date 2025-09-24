import type {
  Settings,
  TeamSelection,
  TeamSearchResult,
  GameStatusPayload,
  NotificationLogEntry,
} from '../../shared/types';

const electronAPI = window.electronAPI;

if (!electronAPI) {
  throw new Error('electronAPI is not available on window. Preload script may be misconfigured.');
}

export const ipcClient = {
  getSettings: () => electronAPI.invoke('settings:get') as Promise<Settings>,
  setSettings: (payload: Partial<Settings>) => electronAPI.invoke('settings:set', payload) as Promise<Settings>,
  getTeams: () => electronAPI.invoke('teams:get') as Promise<TeamSelection[]>,
  addTeam: (team: TeamSelection) => electronAPI.invoke('teams:add', team) as Promise<Settings>,
  removeTeam: (teamId: number) => electronAPI.invoke('teams:remove', { teamId }) as Promise<Settings>,
  searchTeams: (keyword: string) => electronAPI.invoke('teams:search', keyword) as Promise<TeamSearchResult[]>,
  watcherStart: () => electronAPI.invoke('watcher:start') as Promise<unknown>,
  watcherStop: () => electronAPI.invoke('watcher:stop') as Promise<unknown>,
  watcherStatus: (teamId?: number) => electronAPI.invoke('watcher:status', { teamId }) as Promise<GameStatusPayload[]>,
  getNotificationHistory: () => electronAPI.invoke('notifications:history') as Promise<NotificationLogEntry[]>,
  onStatusUpdate: (listener: (payload: GameStatusPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      const payload = args[0];
      if (isGameStatusPayload(payload)) {
        listener(payload);
      }
    };
    window.electronAPI.on('watcher:status:update', handler);
    return () => window.electronAPI.off('watcher:status:update', handler);
  },
  onNotification: (listener: (payload: NotificationLogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      const payload = args[0];
      if (isNotificationLogEntry(payload)) {
        listener(payload);
      }
    };
    window.electronAPI.on('notifications:new', handler);
    return () => window.electronAPI.off('notifications:new', handler);
  },
};

function isGameStatusPayload(value: unknown): value is GameStatusPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<GameStatusPayload>;
  return typeof record.teamId === 'number' && typeof record.teamName === 'string';
}

function isNotificationLogEntry(value: unknown): value is NotificationLogEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<NotificationLogEntry>;
  return typeof record.teamId === 'number' && typeof record.timestampIso === 'string';
}

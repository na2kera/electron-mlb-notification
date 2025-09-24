import { create } from 'zustand';
import type {
  Settings,
  TeamSelection,
  TeamSearchResult,
  GameStatusPayload,
  NotificationLogEntry,
} from '../../shared/types';
import { ipcClient } from '../lib/ipcClient';

export interface StoreState {
  settings: Settings | null;
  teams: TeamSelection[];
  searchResults: TeamSearchResult[];
  searchQuery: string;
  statuses: Record<number, GameStatusPayload>;
  notifications: NotificationLogEntry[];
  isLoading: boolean;
  isSearching: boolean;
  error?: string;
  init: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  searchTeams: (query: string) => Promise<void>;
  addTeam: (team: TeamSearchResult) => Promise<void>;
  removeTeam: (teamId: number) => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  toggleSound: (enabled: boolean) => Promise<void>;
  setPollingInterval: (seconds: number) => Promise<void>;
}

export const useAppStore = create<StoreState>()((set) => ({
  settings: null,
  teams: [],
  searchResults: [],
  searchQuery: '',
  statuses: {},
  notifications: [],
  isLoading: false,
  isSearching: false,
  async init() {
    set({ isLoading: true, error: undefined });
    try {
      const [settings, teams, statuses, notifications] = await Promise.all([
        ipcClient.getSettings(),
        ipcClient.getTeams(),
        ipcClient.watcherStatus(),
        ipcClient.getNotificationHistory(),
      ]);
      set({
        settings,
        teams,
        notifications,
        isLoading: false,
        statuses: mapStatuses(statuses),
      });
    } catch (error) {
      console.error('Failed to initialize store', error);
      set({ isLoading: false, error: '初期化に失敗しました。' });
    }

    ipcClient.onStatusUpdate((payload) => {
      set((state) => ({ statuses: { ...state.statuses, [payload.teamId]: payload } }));
    });

    ipcClient.onNotification((payload) => {
      set((state) => ({ notifications: [payload, ...state.notifications].slice(0, 50) }));
    });
  },
  setSearchQuery(query: string) {
    set({ searchQuery: query });
  },
  async searchTeams(query: string) {
    set({ isSearching: true, error: undefined });
    try {
      const results = query.trim().length > 0 ? await ipcClient.searchTeams(query) : [];
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      console.error('チーム検索に失敗しました', error);
      set({ isSearching: false, error: 'チーム検索に失敗しました。' });
    }
  },
  async addTeam(team: TeamSearchResult) {
    const payload: TeamSelection = {
      teamId: team.id,
      teamName: team.name,
      abbreviation: team.abbreviation,
      addedAtIso: new Date().toISOString(),
    };

    try {
      set({ isLoading: true });
      const settings = await ipcClient.addTeam(payload);
      const teams = settings.teams;
      const statuses = await ipcClient.watcherStatus();
      set({
        settings,
        teams,
        statuses: mapStatuses(statuses),
        isLoading: false,
      });
    } catch (error) {
      console.error('チーム追加に失敗しました', error);
      set({ isLoading: false, error: 'チーム追加に失敗しました。' });
    }
  },
  async removeTeam(teamId: number) {
    try {
      set({ isLoading: true });
      const settings = await ipcClient.removeTeam(teamId);
      const teams = settings.teams;
      const statuses = await ipcClient.watcherStatus();
      set({
        settings,
        teams,
        statuses: mapStatuses(statuses),
        isLoading: false,
      });
    } catch (error) {
      console.error('チーム削除に失敗しました', error);
      set({ isLoading: false, error: 'チーム削除に失敗しました。' });
    }
  },
  async toggleNotifications(enabled: boolean) {
    try {
      const settings = await ipcClient.setSettings({ notificationsEnabled: enabled });
      set({ settings, teams: settings.teams });
    } catch (error) {
      console.error('通知設定の更新に失敗しました', error);
      set({ error: '通知設定の更新に失敗しました。' });
    }
  },
  async toggleSound(enabled: boolean) {
    try {
      const settings = await ipcClient.setSettings({ soundEnabled: enabled });
      set({ settings, teams: settings.teams });
    } catch (error) {
      console.error('サウンド設定の更新に失敗しました', error);
      set({ error: 'サウンド設定の更新に失敗しました。' });
    }
  },
  async setPollingInterval(seconds: number) {
    try {
      const settings = await ipcClient.setSettings({ pollingIntervalSec: seconds });
      set({ settings, teams: settings.teams });
    } catch (error) {
      console.error('ポーリング間隔の更新に失敗しました', error);
      set({ error: 'ポーリング間隔の更新に失敗しました。' });
    }
  },
}));

function mapStatuses(statuses: GameStatusPayload[]): Record<number, GameStatusPayload> {
  return statuses.reduce<Record<number, GameStatusPayload>>((acc, status) => {
    acc[status.teamId] = status;
    return acc;
  }, {});
}

import { ipcMain } from 'electron';
import type { Settings, TeamSelection, TeamSearchResult } from '../shared/types';
import type { SettingsStore } from './settingsStore';
import type { GameWatcher } from './services/gameWatcher';
import type { MLBStatsApi } from './services/mlbApi';
import { logger } from './logger';

interface IpcContext {
  settingsStore: SettingsStore;
  gameWatcher: GameWatcher;
  mlbApi: MLBStatsApi;
}

export function registerIpcHandlers({ settingsStore, gameWatcher, mlbApi }: IpcContext) {
  ipcMain.handle('settings:get', async () => {
    logger.debug('IPC settings:get');
    return settingsStore.getSettings();
  });

  ipcMain.handle('settings:set', async (_event, payload: Partial<Settings>) => {
    logger.info('IPC settings:set', payload);
    const updated = settingsStore.updateSettings(payload);
    gameWatcher.start(updated);
    return updated;
  });

  ipcMain.handle('teams:get', async () => settingsStore.getSettings().teams);

  ipcMain.handle('teams:add', async (_event, payload: TeamSelection) => {
    logger.info('IPC teams:add', payload);
    const updated = settingsStore.addTeam(payload);
    gameWatcher.start(updated);
    return updated;
  });

  ipcMain.handle('teams:search', async (_event, keyword: string) => {
    logger.debug('IPC teams:search', keyword);
    const results = await mlbApi.searchTeams(keyword ?? '');
    return results satisfies TeamSearchResult[];
  });

  ipcMain.handle('teams:remove', async (_event, payload: { teamId: number }) => {
    logger.info('IPC teams:remove', payload);
    const updated = settingsStore.removeTeam(payload.teamId);
    gameWatcher.start(updated);
    return updated;
  });

  ipcMain.handle('watcher:start', async () => {
    logger.debug('IPC watcher:start');
    const settings = settingsStore.getSettings();
    gameWatcher.start(settings);
    return { state: 'running', settings };
  });

  ipcMain.handle('watcher:stop', async () => {
    logger.debug('IPC watcher:stop');
    gameWatcher.stop();
    return { state: 'idle' };
  });

  ipcMain.handle('watcher:status', async (_event, payload?: { teamId?: number }) => {
    logger.debug('IPC watcher:status', payload);
    return gameWatcher.getStatus(payload?.teamId);
  });

  ipcMain.handle('notifications:history', async () => {
    logger.debug('IPC notifications:history');
    return gameWatcher.getNotifications();
  });
}

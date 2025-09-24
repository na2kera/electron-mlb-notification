import { app, BrowserWindow } from 'electron';
import path from 'path';
import { SettingsStore } from './settingsStore';
import { registerIpcHandlers } from './ipc';
import { GameWatcher } from './services/gameWatcher';
import { Notifier } from './notifier';
import { logger } from './logger';
import type { GameStatusPayload, NotificationLogEntry } from '../shared/types';
import { MLBStatsApi } from './services/mlbApi';

type BroadcastChannel = 'watcher:status:update' | 'notifications:new';

let mainWindow: BrowserWindow | null = null;

const settingsStore = new SettingsStore();
const gameWatcher = new GameWatcher(settingsStore.getSettings());
const notifier = new Notifier();
const mlbApi = new MLBStatsApi();

const broadcastToRenderer = (
  channel: BroadcastChannel,
  payload: GameStatusPayload | NotificationLogEntry
) => {
  BrowserWindow.getAllWindows().forEach((windowInstance) => {
    windowInstance.webContents.send(channel, payload);
  });
};

gameWatcher.on('status', (payload) => {
  broadcastToRenderer('watcher:status:update', payload);
});

gameWatcher.on('notification', (notification) => {
  notifier.show(notification, settingsStore.getSettings());
  broadcastToRenderer('notifications:new', notification);
});

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexHtmlPath = path.join(__dirname, '..', 'index.html');
  mainWindow
    .loadFile(indexHtmlPath)
    .then(() => {
      logger.info('Renderer loaded');
    })
    .catch((error) => {
      logger.error('Failed to load renderer', error);
    });

  if (process.env.NODE_ENV === 'development') {
    try {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch (error) {
      logger.warn('Failed to open devtools', error);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const initialize = async () => {
  registerIpcHandlers({ settingsStore, gameWatcher, mlbApi });

  await app.whenReady();

  createMainWindow();

  const settings = settingsStore.getSettings();
  if (settings.teams.length > 0) {
    gameWatcher.start(settings);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
};

initialize().catch((error) => {
  logger.error('Failed to initialize application', error);
});

app.on('window-all-closed', () => {
  gameWatcher.stop();
  app.quit();
});

app.on('before-quit', () => {
  gameWatcher.stop();
});

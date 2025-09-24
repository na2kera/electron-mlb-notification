import { contextBridge, ipcRenderer } from 'electron';

const invokeChannels = [
  'settings:get',
  'settings:set',
  'teams:get',
  'teams:add',
  'teams:search',
  'teams:remove',
  'watcher:start',
  'watcher:stop',
  'watcher:status',
  'notifications:history',
] as const;

const eventChannels = [
  'watcher:status:update',
  'notifications:new',
] as const;

type InvokeChannel = (typeof invokeChannels)[number];
type EventChannel = (typeof eventChannels)[number];

type IpcRequestPayload = unknown;

type IpcApi = {
  invoke: (channel: InvokeChannel, payload?: IpcRequestPayload) => Promise<unknown>;
  on: (channel: EventChannel, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void) => void;
  off: (channel: EventChannel, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void) => void;
};

const api: IpcApi = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload as never),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  off: (channel, listener) => ipcRenderer.removeListener(channel, listener),
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI: IpcApi;
  }
}

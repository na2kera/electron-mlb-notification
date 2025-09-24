import Store from 'electron-store';
import { EventEmitter } from 'node:events';
import type { Settings, TeamSelection } from '../shared/types';

export interface SettingsUpdatePayload {
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  teams: [],
  pollingIntervalSec: 30,
  notificationsEnabled: true,
  soundEnabled: false,
};

export class SettingsStore extends EventEmitter {
  private store: Store<Settings>;

  constructor() {
    super();
    this.store = new Store<Settings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
    });
  }

  getSettings(): Settings {
    return this.store.store;
  }

  updateSettings(partial: Partial<Settings>): Settings {
    const merged = { ...this.getSettings(), ...partial };
    this.store.set(merged);
    this.emit('change', { settings: merged } satisfies SettingsUpdatePayload);
    return merged;
  }

  addTeam(selection: TeamSelection): Settings {
    const settings = this.getSettings();
    if (settings.teams.some((team) => team.teamId === selection.teamId)) {
      return settings;
    }

    const teams = [...settings.teams, selection];
    const updated = this.updateSettings({ teams });
    return updated;
  }

  removeTeam(teamId: number): Settings {
    const settings = this.getSettings();
    const teams = settings.teams.filter((team) => team.teamId !== teamId);
    const updated = this.updateSettings({ teams });
    return updated;
  }
}

import { EventEmitter } from 'node:events';
import { MLBStatsApi } from './mlbApi';
import { logger } from '../logger';
import type {
  GameStatusPayload,
  LinescoreSummary,
  NotificationLogEntry,
  Settings,
  TeamSelection,
} from '../../shared/types';

interface WatcherOptions {
  pollingIntervalSec: number;
}

interface WatcherState {
  status: 'idle' | 'running';
  monitoredTeams: TeamSelection[];
  notifications: NotificationLogEntry[];
}

interface GameCacheEntry {
  cacheKey: string;
  gamePk: number;
  lastLinescore: LinescoreSummary | null;
  teamId: number;
  teamName: string;
}

type WatcherEvents = {
  status: [GameStatusPayload];
  notification: [NotificationLogEntry];
};

export class GameWatcher extends EventEmitter {
  private api: MLBStatsApi;
  private intervalHandle: NodeJS.Timeout | null = null;
  private settings: Settings;
  private state: WatcherState;
  private cache = new Map<string, GameCacheEntry>();
  private statusByTeam = new Map<number, GameStatusPayload>();

  constructor(settings: Settings, api: MLBStatsApi = new MLBStatsApi()) {
    super();
    this.api = api;
    this.settings = settings;
    this.state = {
      status: 'idle',
      monitoredTeams: settings.teams,
      notifications: [],
    } satisfies WatcherState;
  }

  start(settings: Settings) {
    logger.info('Starting game watcher');
    this.stop();
    this.settings = settings;
    this.state.monitoredTeams = settings.teams;

    if (settings.teams.length === 0) {
      logger.info('No teams configured for monitoring');
      return;
    }

    this.runTick();
    this.intervalHandle = setInterval(
      () => this.runTick(),
      Math.max(settings.pollingIntervalSec * 1000, 10_000)
    );
    this.state.status = 'running';
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.cache.clear();
    this.statusByTeam.clear();
    this.state.status = 'idle';
  }

  getStatus(teamId?: number): GameStatusPayload[] {
    const statuses = Array.from(this.statusByTeam.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
    return teamId ? statuses.filter((status) => status.teamId === teamId) : statuses;
  }

  getNotifications(): NotificationLogEntry[] {
    return [...this.state.notifications];
  }

  private async runTick() {
    logger.debug('Watcher tick');

    try {
      const now = new Date();
      const dateIso = now.toISOString().slice(0, 10);

      const teamQueue = [...this.settings.teams];
      const limit = 2;

      const runNext = async (): Promise<void> => {
        const team = teamQueue.shift();
        if (!team) {
          return;
        }
        await this.processTeam(team, dateIso);
        await runNext();
      };

      const runners = Array.from({ length: Math.min(limit, teamQueue.length) }, () => runNext());
      await Promise.all(runners);
    } catch (error) {
      logger.error('Watcher tick failed', error);
    }
  }

  private async processTeam(team: TeamSelection, dateIso: string) {
    try {
      const schedule = await this.api.getTeamSchedule(team.teamId, dateIso);
      const liveGames = schedule.filter((game) => game.abstractState === 'Live');
      const upcoming = schedule.filter((game) => game.abstractState === 'Preview' || game.abstractState === 'Pre-Game');
      const finalGames = schedule.filter((game) => game.abstractState === 'Final');

      if (liveGames.length === 0) {
        const previousLinescore = this.getLatestLinescore(team.teamId);
        this.removeCacheEntriesForTeam(team.teamId);
        this.emitStatus({
          teamId: team.teamId,
          teamName: team.teamName,
          state: upcoming.length ? 'scheduled' : finalGames.length ? 'final' : 'idle',
          lastUpdatedIso: new Date().toISOString(),
          linescore: previousLinescore ?? undefined,
          message: upcoming.length
            ? `Next game vs ${upcoming[0].awayTeam.id === team.teamId ? upcoming[0].homeTeam.name : upcoming[0].awayTeam.name}`
            : 'No active game today',
        });
        return;
      }

      for (const game of liveGames) {
        await this.processLiveGame(team, game.gamePk);
      }
    } catch (error) {
      logger.error('Failed to process team schedule', { team, error });
      this.emitStatus({
        teamId: team.teamId,
        teamName: team.teamName,
        state: 'error',
        lastUpdatedIso: new Date().toISOString(),
        message: 'Failed to load schedule',
      });
    }
  }

  private async processLiveGame(team: TeamSelection, gamePk: number) {
    const feed = await this.api.getGameFeed(gamePk);
    if (!feed) {
      return;
    }

    const cacheKey = this.getCacheKey(team.teamId, gamePk);
    let entry = this.cache.get(cacheKey);

    if (!entry) {
      entry = {
        cacheKey,
        gamePk,
        lastLinescore: feed,
        teamId: team.teamId,
        teamName: team.teamName,
      } satisfies GameCacheEntry;
      this.cache.set(cacheKey, entry);
      this.emitStatus({
        teamId: team.teamId,
        teamName: team.teamName,
        state: 'live',
        lastUpdatedIso: new Date().toISOString(),
        linescore: feed,
      });
      return;
    }

    if (!this.hasScoreChanged(entry.lastLinescore, feed, team.teamId)) {
      this.emitStatus({
        teamId: team.teamId,
        teamName: team.teamName,
        state: 'live',
        lastUpdatedIso: new Date().toISOString(),
        linescore: feed,
      });
      entry.lastLinescore = feed;
      return;
    }

    const notification: NotificationLogEntry = {
      teamId: team.teamId,
      teamName: team.teamName,
      title: `${team.teamName} scored!`,
      body: `Updated score: ${feed.home.team.abbreviation} ${feed.home.runs} - ${feed.away.runs} ${feed.away.team.abbreviation}`,
      timestampIso: new Date().toISOString(),
      gamePk,
    } satisfies NotificationLogEntry;

    this.emit('notification', notification);
    this.state.notifications = [notification, ...this.state.notifications].slice(0, 50);
    entry.lastLinescore = feed;
    this.emitStatus({
      teamId: team.teamId,
      teamName: team.teamName,
      state: 'live',
      lastUpdatedIso: new Date().toISOString(),
      linescore: feed,
    });
  }

  private hasScoreChanged(prev: LinescoreSummary | null, next: LinescoreSummary, teamId: number): boolean {
    if (!prev) {
      return true;
    }

    const prevRuns = prev.home.team.id === teamId ? prev.home.runs : prev.away.runs;
    const nextRuns = next.home.team.id === teamId ? next.home.runs : next.away.runs;

    return (prevRuns ?? 0) !== (nextRuns ?? 0);
  }

  private emitStatus(payload: GameStatusPayload) {
    this.statusByTeam.set(payload.teamId, payload);
    this.emit('status', payload);
  }

  private getCacheKey(teamId: number, gamePk: number) {
    return `${teamId}-${gamePk}`;
  }

  private removeCacheEntriesForTeam(teamId: number) {
    for (const entry of this.cache.values()) {
      if (entry.teamId === teamId) {
        this.cache.delete(entry.cacheKey);
      }
    }
  }

  private getLatestLinescore(teamId: number): LinescoreSummary | null {
    const entry = Array.from(this.cache.values()).find((item) => item.teamId === teamId);
    return entry?.lastLinescore ?? null;
  }

  override on<Event extends keyof WatcherEvents>(event: Event, listener: (...args: WatcherEvents[Event]) => void) {
    return super.on(event, listener);
  }
}

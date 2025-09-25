import { logger } from '../logger';
import type {
  ScheduleGameSummary,
  TeamInfo,
  TeamSearchResult,
  LinescoreSummary,
  TeamScoreSummary,
} from '../../shared/types';
import { FALLBACK_TEAMS } from './teamFallback';

const BASE_URL = 'https://statsapi.mlb.com/api/v1';
const LIVE_FEED_BASE_URL = 'https://statsapi.mlb.com/api/v1.1';

interface FetchOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

interface TeamsResponse {
  teams: Array<{
    id: number;
    name: string;
    abbreviation: string;
    locationName: string;
    venue?: { name?: string };
  }>;
}

interface ScheduleResponse {
  dates: Array<{
    date: string;
    games: Array<{
      gamePk: number;
      gameDate: string;
      status: {
        detailedState: string;
        abstractGameState: string;
      };
      teams: {
        home: {
          team: { id: number; name: string; abbreviation: string };
        };
        away: {
          team: { id: number; name: string; abbreviation: string };
        };
      };
    }>;
  }>;
}

interface GameFeedResponse {
  gameData: {
    teams: {
      home: { id: number; name: string; abbreviation: string };
      away: { id: number; name: string; abbreviation: string };
    };
  };
  liveData: {
    linescore?: {
      currentInning?: number;
      inningState?: string;
      teams: {
        home: { runs: number | null; hits: number | null; errors: number | null };
        away: { runs: number | null; hits: number | null; errors: number | null };
      };
    };
    plays?: {
      allPlays: Array<{
        playEvents?: Array<unknown>;
        about: {
          atBatIndex: number;
          result?: string;
          halfInning?: string;
          isScoringPlay?: boolean;
        };
        result?: {
          description?: string;
          event?: string;
          rbi?: number;
        };
        matchup?: {
          batter?: { fullName?: string };
        };
      }>;
      scoringPlays?: number[];
    };
  };
}

export class MLBApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly body?: string
  ) {
    super(`MLB API error: ${status} ${statusText}`);
    this.name = 'MLBApiHttpError';
  }
}

function joinUrl(base: string, pathname: string): URL {
  const normalizedBase = base.endsWith('/') ? base : base + '/';
  const normalizedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  return new URL(normalizedPath, normalizedBase);
}

function buildUrl(pathname: string, options: FetchOptions = {}) {
  const url = joinUrl(BASE_URL, pathname);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url;
}

async function fetchJson<T>(url: URL, options: FetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: options.signal ?? controller.signal,
      headers: {
        'User-Agent': 'MLB Score Notifier (Electron App)',
      },
    });

    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export class MLBStatsApi {
  private teamCache: TeamSearchResult[] | null = null;
  private lastTeamFetch: number | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getAllTeams(): Promise<TeamSearchResult[]> {
    const now = Date.now();
    if (this.teamCache && this.lastTeamFetch && now - this.lastTeamFetch < 1000 * 60 * 15) {
      return this.teamCache;
    }

    try {
      const url = buildUrl('/teams', { query: { sportId: 1 } });
      const json = await this.fetchJson<TeamsResponse>(url);
      this.teamCache = json.teams.map((team) => ({
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        locationName: team.locationName,
        venueName: team.venue?.name,
      }));
      this.lastTeamFetch = now;
      return this.teamCache;
    } catch (error) {
      if (this.teamCache) {
        logger.warn('Falling back to cached team list after failure', { error });
        return this.teamCache;
      }

      logger.error('Failed to fetch team list, using fallback data', { error });
      this.teamCache = FALLBACK_TEAMS;
      this.lastTeamFetch = now;
      return FALLBACK_TEAMS;
    }
  }

  async searchTeams(keyword: string): Promise<TeamSearchResult[]> {
    const trimmed = keyword.trim().toLowerCase();
    const teams = await this.getAllTeams();

    if (!trimmed) {
      return teams;
    }

    return teams.filter((team) =>
      [team.name, team.abbreviation, team.locationName]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(trimmed))
    );
  }

  async getTeamSchedule(teamId: number, dateIso: string): Promise<ScheduleGameSummary[]> {
    const url = buildUrl('/schedule', {
      query: {
        sportId: 1,
        teamId,
        date: dateIso,
      },
    });

    try {
      logger.debug('MLB schedule request', { teamId, dateIso, url: url.toString() });
      const json = await this.fetchJson<ScheduleResponse>(url);
      const games = json.dates.flatMap((date) => date.games);
      return games.map((game) => ({
        gamePk: game.gamePk,
        startTime: game.gameDate,
        detailedState: game.status.detailedState,
        abstractState: game.status.abstractGameState,
        homeTeam: this.mapTeam(game.teams.home.team),
        awayTeam: this.mapTeam(game.teams.away.team),
      }));
    } catch (error) {
      if (error instanceof MLBApiHttpError) {
        logger.warn('Failed to fetch team schedule', {
          teamId,
          dateIso,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          body: error.body,
        });
        throw error;
      }
      logger.warn('Failed to fetch team schedule', { teamId, dateIso, error });
      throw error;
    }
  }

  async getGameFeed(gamePk: number): Promise<LinescoreSummary | null> {
    try {
      const url = joinUrl(LIVE_FEED_BASE_URL, `game/${gamePk}/feed/live`);
      const json = await this.fetchJson<GameFeedResponse>(url);
      const linescore = json.liveData.linescore;
      if (!linescore) {
        return null;
      }

      const mapScore = (team: { id: number; name: string; abbreviation: string },
        scores: { runs: number | null; hits: number | null; errors: number | null }): TeamScoreSummary => ({
        team: this.mapTeam(team),
        runs: scores.runs ?? 0,
        hits: scores.hits ?? undefined,
        errors: scores.errors ?? undefined,
      });

      return {
        home: mapScore(json.gameData.teams.home, linescore.teams.home),
        away: mapScore(json.gameData.teams.away, linescore.teams.away),
        inning: linescore.currentInning,
        inningState: linescore.inningState,
      } satisfies LinescoreSummary;
    } catch (error) {
      logger.warn('Failed to fetch game feed', { gamePk, error });
      return null;
    }
  }

  private async fetchJson<T>(url: URL, options: FetchOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await this.fetchImpl(url, {
        signal: options.signal ?? controller.signal,
        headers: {
          'User-Agent': 'MLB Score Notifier (Electron App)',
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => undefined);
        throw new MLBApiHttpError(response.status, response.statusText, url.toString(), body);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapTeam(team: { id: number; name: string; abbreviation: string }): TeamInfo {
    return {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
    };
  }
}

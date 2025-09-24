export type GameState = 'idle' | 'scheduled' | 'live' | 'final' | 'postponed' | 'ended' | 'error';

export interface TeamInfo {
  id: number;
  name: string;
  abbreviation: string;
  venue?: string;
}

export interface TeamSelection {
  teamId: number;
  teamName: string;
  abbreviation: string;
  addedAtIso: string;
}

export interface Settings {
  teams: TeamSelection[];
  pollingIntervalSec: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export interface ScheduleGameSummary {
  gamePk: number;
  startTime: string;
  detailedState: string;
  abstractState: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
}

export interface LinescoreSummary {
  home: TeamScoreSummary;
  away: TeamScoreSummary;
  inning?: number;
  inningState?: string;
}

export interface TeamScoreSummary {
  team: TeamInfo;
  runs: number | null;
  hits?: number | null;
  errors?: number | null;
}

export interface GameStatusPayload {
  teamId: number;
  teamName: string;
  state: GameState;
  lastUpdatedIso: string;
  scheduleGame?: ScheduleGameSummary;
  linescore?: LinescoreSummary;
  message?: string;
}

export interface NotificationPayload {
  teamId: number;
  teamName: string;
  title: string;
  body: string;
  timestampIso: string;
  gamePk: number;
}

export interface NotificationLogEntry extends NotificationPayload {}

export interface TeamSearchResult {
  id: number;
  name: string;
  abbreviation: string;
  locationName?: string;
  venueName?: string;
}

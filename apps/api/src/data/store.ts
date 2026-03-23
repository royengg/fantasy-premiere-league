import type {
  AuthSession,
  Badge,
  Contest,
  CosmeticItem,
  CosmeticUnlock,
  FantasyScoreEvent,
  Friendship,
  Invite,
  LeaderboardEntry,
  League,
  Match,
  Player,
  PlayerMatchStatLine,
  PredictionAnswer,
  PredictionQuestion,
  PredictionResult,
  Profile,
  Roster,
  Team,
  User,
  UserInventory,
  XPTransaction
} from "@fantasy-cricket/types";

export interface AuthCredential {
  userId: string;
  passwordHash: string;
  updatedAt: string;
}

export interface ProviderSyncState {
  status: "idle" | "syncing" | "ready";
  syncedAt: string;
  lastAttemptedAt: string;
  requestDayKey: string;
  dailyRequestCount: number;
  blockedUntil?: string;
}

export interface AppStore {
  sessions: AuthSession[];
  credentials: AuthCredential[];
  users: User[];
  profiles: Profile[];
  friendships: Friendship[];
  invites: Invite[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  contests: Contest[];
  leagues: League[];
  rosters: Roster[];
  playerMatchStatLines: PlayerMatchStatLine[];
  scoreEvents: FantasyScoreEvent[];
  leaderboard: LeaderboardEntry[];
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  results: PredictionResult[];
  cosmetics: CosmeticItem[];
  cosmeticUnlocks: CosmeticUnlock[];
  inventories: UserInventory[];
  badges: Badge[];
  xpTransactions: XPTransaction[];
  provider: ProviderSyncState;
}

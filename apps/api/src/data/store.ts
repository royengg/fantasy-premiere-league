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

export interface ProviderSyncState {
  status: "idle" | "syncing" | "ready";
  syncedAt: string;
}

export interface AppStore {
  sessions: AuthSession[];
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

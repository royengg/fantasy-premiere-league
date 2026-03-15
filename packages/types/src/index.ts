export * from "./cricket-data";

export type ID = string;

export type TeamRole = "WK" | "BAT" | "AR" | "BOWL";
export type MatchState = "scheduled" | "live" | "completed";
export type LeagueVisibility = "public" | "private";
export type ContestKind = "public" | "private";
export type PredictionCategory = "toss" | "powerplay-runs" | "most-wickets" | "highest-score" | "man-of-match" | "winner" | "player-performance" | "total" | "milestone";
export type PredictionState = "open" | "locked" | "settled";
export type BadgeCategory = "streak" | "rank" | "seasonal" | "milestone";
export type CosmeticCategory =
  | "profile-theme"
  | "avatar-frame"
  | "league-banner"
  | "card-skin"
  | "badge-title";
export type CosmeticRarity = "common" | "rare" | "epic";
export type PlayerNationality = "indian-capped" | "indian-uncapped" | "overseas";
export type FormIndicator = "hot" | "good" | "average" | "cold";

export interface User {
  id: ID;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  userId: ID;
  createdAt: string;
  expiresAt: string;
}

export interface AuthResponse {
  token: string;
  userId: ID;
  profileUsername: string;
  expiresAt: string;
  onboardingCompleted: boolean;
}

export interface Profile {
  userId: ID;
  username: string;
  bio?: string;
  favoriteTeamId?: ID;
  xp: number;
  level: number;
  streak: number;
  onboardingCompleted: boolean;
  equippedCosmetics: Partial<Record<CosmeticCategory, ID>>;
}

export interface Friendship {
  id: ID;
  requesterId: ID;
  addresseeId: ID;
  status: "pending" | "accepted";
  createdAt: string;
}

export interface Invite {
  id: ID;
  leagueId: ID;
  code: string;
  createdBy: ID;
  createdAt: string;
  expiresAt?: string;
}

export interface Team {
  id: ID;
  name: string;
  shortName: string;
  city: string;
}

export interface Player {
  id: ID;
  name: string;
  teamId: ID;
  role: TeamRole;
  credits: number;
  rating: number;
  nationality: PlayerNationality;
  selectionPercent: number;
}

export interface PlayerStats {
  playerId: ID;
  lastFiveMatches: number[];
  totalPoints: number;
  averagePoints: number;
  highestScore: number;
  vsTeam: Record<ID, { matches: number; avgPoints: number }>;
  venueRecord: Record<string, { matches: number; avgPoints: number }>;
  form: FormIndicator;
}

export interface Match {
  id: ID;
  homeTeamId: ID;
  awayTeamId: ID;
  startsAt: string;
  venue: string;
  state: MatchState;
}

export interface LiveMatchData {
  matchId: ID;
  innings: 1 | 2;
  currentOver: number;
  currentBall: number;
  battingTeamId: ID;
  bowlingTeamId: ID;
  score: number;
  wickets: number;
  overs: string;
  currentBatsmen: { playerId: ID; runs: number; balls: number }[];
  currentBowler: { playerId: ID; overs: number; wickets: number; runs: number };
  partnership: { runs: number; balls: number };
  requiredRunRate?: number;
  currentRunRate: number;
  recentBalls: BallEvent[];
  target?: number;
}

export interface BallEvent {
  over: number;
  ball: number;
  runs: number;
  type: "run" | "boundary" | "six" | "wicket" | "wide" | "no-ball" | "dot";
  batsmanId: ID;
  bowlerId: ID;
  points: number;
  description: string;
  timestamp: string;
}

export interface RosterRules {
  totalPlayers: number;
  minByRole: Record<TeamRole, number>;
  maxByRole: Record<TeamRole, number>;
  maxPerTeam: number;
}

export interface IPLRules {
  maxPlayersPerTeam: 7;
  allowImpactPlayer: boolean;
  uncappedBonusPoints: number;
}

export interface SeasonReward {
  id: ID;
  name: string;
  type: "xp" | "badge" | "cosmetic";
  value: number;
  badgeId?: ID;
  cosmeticId?: ID;
}

export interface Contest {
  id: ID;
  name: string;
  kind: ContestKind;
  matchId: ID;
  leagueId?: ID;
  salaryCap: number;
  rosterRules: RosterRules;
  iplRules: IPLRules;
  lockTime: string;
  rewards: SeasonReward[];
}

export interface League {
  id: ID;
  name: string;
  description?: string;
  visibility: LeagueVisibility;
  createdBy: ID;
  inviteCode: string;
  memberIds: ID[];
  contestIds: ID[];
  bannerStyle: string;
}

export interface RosterPlayerSelection {
  playerId: ID;
}

export interface Roster {
  id: ID;
  contestId: ID;
  userId: ID;
  players: RosterPlayerSelection[];
  captainPlayerId: ID;
  viceCaptainPlayerId: ID;
  impactPlayerId?: ID;
  totalCredits: number;
  submittedAt: string;
  locked: boolean;
  hasUncappedPlayer: boolean;
}

export interface LiveRosterPoints {
  rosterId: ID;
  userId: ID;
  totalPoints: number;
  projectedPoints: number;
  rank: number;
  previousRank: number;
  playerPoints: { playerId: ID; points: number; projectedPoints: number; recentEvents: BallEvent[] }[];
}

export interface FantasyScoreEvent {
  id: ID;
  matchId: ID;
  playerId: ID;
  label: string;
  points: number;
  createdAt: string;
}

export interface PlayerPointsBreakdown {
  playerId: ID;
  playerName: string;
  basePoints: number;
  multiplier: number;
  finalPoints: number;
}

export interface LeaderboardEntry {
  id: ID;
  contestId: ID;
  userId: ID;
  points: number;
  rank: number;
  previousRank: number;
  trend: "up" | "down" | "steady";
  projectedPoints?: number;
}

export interface PredictionOption {
  id: ID;
  label: string;
  value: string;
}

export interface PredictionQuestion {
  id: ID;
  matchId: ID;
  prompt: string;
  category: PredictionCategory;
  options: PredictionOption[];
  locksAt: string;
  resolvesAt: string;
  state: PredictionState;
  xpReward: number;
  badgeRewardId?: ID;
  cosmeticRewardId?: ID;
}

export interface PredictionAnswer {
  id: ID;
  questionId: ID;
  userId: ID;
  optionId: ID;
  submittedAt: string;
}

export interface PredictionResult {
  questionId: ID;
  userId: ID;
  correctOptionId: ID;
  awardedXp: number;
  awardedBadgeId?: ID;
  awardedCosmeticId?: ID;
  streak: number;
  settledAt: string;
}

export interface XPTransaction {
  id: ID;
  userId: ID;
  source: "prediction" | "fantasy" | "seasonal" | "admin";
  amount: number;
  description: string;
  createdAt: string;
}

export interface CosmeticItem {
  id: ID;
  name: string;
  description: string;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  themeToken: string;
  gameplayAffecting: false;
  transferable: false;
  redeemable: false;
  resaleValue: false;
}

export interface CosmeticUnlock {
  id: ID;
  userId: ID;
  cosmeticId: ID;
  source: "prediction" | "seasonal" | "admin";
  unlockedAt: string;
}

export interface UserInventory {
  userId: ID;
  cosmeticIds: ID[];
  badgeIds: ID[];
  equipped: Partial<Record<CosmeticCategory, ID>>;
}

export interface Badge {
  id: ID;
  label: string;
  description: string;
  category: BadgeCategory;
  seasonId?: ID;
}

export interface DashboardPayload {
  user: User;
  profile: Profile;
  contests: Contest[];
  leagues: League[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  playerStats: PlayerStats[];
  rosters: Roster[];
  leaderboard: LeaderboardEntry[];
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  results: PredictionResult[];
  inventory: UserInventory;
  cosmetics: CosmeticItem[];
  badges: Badge[];
  xpTransactions: XPTransaction[];
}

export interface RosterValidationResult {
  valid: boolean;
  totalCredits: number;
  errors: string[];
  warnings: string[];
  teamCount: Record<ID, number>;
  hasUncappedPlayer: boolean;
}

export interface BuildRosterInput {
  playerIds: ID[];
  captainPlayerId: ID;
  viceCaptainPlayerId: ID;
  impactPlayerId?: ID;
}

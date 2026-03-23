export * from "./cricket-data";

export type ID = string;

export type TeamRole = "WK" | "BAT" | "AR" | "BOWL";
export type MatchState = "scheduled" | "live" | "completed";
export type LeagueVisibility = "public" | "private";
export type ContestKind = "public" | "private";
export type AuctionRoomVisibility = "public" | "private";
export type AuctionRoomState = "waiting" | "live" | "completed" | "cancelled";
export type AuctionPlayerPoolMode = "all" | "custom";
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

export interface User {
  id: ID;
  email: string;
  name: string;
  isAdmin: boolean;
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

export interface TeamWithPlayers extends Team {
  players: Player[];
}

export interface Player {
  id: ID;
  name: string;
  teamId: ID;
  role: TeamRole;
  rating: number;
  nationality: PlayerNationality;
  selectionPercent: number;
}

export interface Match {
  id: ID;
  homeTeamId: ID;
  awayTeamId: ID;
  startsAt: string;
  venue: string;
  state: MatchState;
}

export interface RosterRules {
  startingPlayers: number;
  substitutePlayers: number;
  totalPlayers: number;
  minByRole: Record<TeamRole, number>;
  maxByRole: Record<TeamRole, number>;
  maxPerTeam: number;
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
  rosterRules: RosterRules;
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
  mode: "season";
  maxMembers: number;
  squadSize: number;
  auctionRoomId?: ID;
}

export interface AuctionRoomSettings {
  leagueId?: ID;
  maxParticipants: number;
  squadSize: number;
  purseLakhs: number;
  basePriceLakhs: number;
  bidWindowSeconds: number;
  bidExtensionSeconds: number;
  maxOverseas: number;
  playerPoolMode: AuctionPlayerPoolMode;
}

export interface AuctionCatalogPlayer {
  playerId: ID;
  name: string;
  teamId: ID;
  teamName: string;
  teamShortName: string;
  role: TeamRole;
  nationality: PlayerNationality;
  rating: number;
}

export interface AuctionParticipant {
  userId: ID;
  displayName: string;
  isHost: boolean;
  ready: boolean;
  purseRemainingLakhs: number;
  slotsRemaining: number;
  overseasCount: number;
  joinedAt: string;
}

export interface AuctionRoomSummary {
  id: ID;
  leagueId?: ID;
  leagueName?: string;
  name: string;
  visibility: AuctionRoomVisibility;
  state: AuctionRoomState;
  hostUserId: ID;
  hostDisplayName: string;
  inviteCode?: string;
  participantCount: number;
  maxParticipants: number;
  squadSize: number;
  bidWindowSeconds: number;
  playerPoolMode: AuctionPlayerPoolMode;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AuctionLot {
  poolEntryId: ID;
  playerId: ID;
  playerName: string;
  teamId: ID;
  teamName: string;
  teamShortName: string;
  role: TeamRole;
  nationality: PlayerNationality;
  nominationOrder: number;
  openingBidLakhs: number;
  currentBidLakhs?: number;
  currentLeaderUserId?: ID;
  currentLeaderDisplayName?: string;
  lotEndsAt?: string;
  state: "pending" | "active" | "sold" | "unsold";
  soldPriceLakhs?: number;
  soldToUserId?: ID;
  soldToDisplayName?: string;
}

export interface AuctionBidEntry {
  id: ID;
  roomId: ID;
  poolEntryId: ID;
  userId: ID;
  displayName: string;
  amountLakhs: number;
  createdAt: string;
}

export interface AuctionRosterEntry {
  playerId: ID;
  playerName: string;
  teamId: ID;
  teamName: string;
  teamShortName: string;
  role: TeamRole;
  nationality: PlayerNationality;
  priceLakhs: number;
}

export interface AuctionRoster {
  userId: ID;
  displayName: string;
  players: AuctionRosterEntry[];
  totalSpentLakhs: number;
  purseRemainingLakhs: number;
  slotsRemaining: number;
}

export interface AuctionEventLogEntry {
  id: ID;
  type:
    | "room-created"
    | "participant-joined"
    | "participant-ready"
    | "settings-updated"
    | "auction-started"
    | "player-nominated"
    | "bid-placed"
    | "participant-withdrew"
    | "skip-voted"
    | "player-sold"
    | "player-unsold"
    | "auction-completed";
  actorUserId?: ID;
  message: string;
  createdAt: string;
}

export interface AuctionRoomDetails {
  room: AuctionRoomSummary;
  settings: AuctionRoomSettings;
  participants: AuctionParticipant[];
  currentLot?: AuctionLot;
  recentBids: AuctionBidEntry[];
  rosters: AuctionRoster[];
  selectedPlayerIds: ID[];
  pendingPlayerCount: number;
  totalPoolCount: number;
  skipVoteUserIds: ID[];
  withdrawnUserIds: ID[];
  eventLog: AuctionEventLogEntry[];
}

export interface RosterPlayerSelection {
  playerId: ID;
  isStarter: boolean;
}

export interface Roster {
  id: ID;
  contestId: ID;
  userId: ID;
  players: RosterPlayerSelection[];
  captainPlayerId: ID;
  viceCaptainPlayerId: ID;
  submittedAt: string;
  locked: boolean;
}

export interface PlayerMatchStatLine {
  id: ID;
  matchId: ID;
  playerId: ID;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  maidens: number;
  dotBalls: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  runsConceded: number;
  ballsBowled: number;
  battingStrikeRate?: number;
  bowlingEconomy?: number;
  didPlay: boolean;
  didBat: boolean;
  didBowl: boolean;
  didField: boolean;
  sourceUpdatedAt: string;
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
  role?: TeamRole;
  isStarter?: boolean;
  didPlay?: boolean;
  replacedPlayerId?: ID;
  replacedPlayerName?: string;
  autoSubstituted?: boolean;
}

export interface LeaderboardEntry {
  id: ID;
  contestId: ID;
  userId: ID;
  displayName?: string;
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
  id: ID;
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
  resaleValue: number;
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

export interface BootstrapPayload {
  user: User;
  profile: Profile;
  teams: Team[];
}

export interface HomePagePayload {
  user: User;
  profile: Profile;
  contests: Contest[];
  matches: Match[];
  teams: Team[];
  leagueCount: number;
  lockerItemCount: number;
}

export interface ContestPagePayload {
  contests: Contest[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  rosters: Roster[];
  leaderboard: LeaderboardEntry[];
}

export interface DashboardPayload {
  user: User;
  profile: Profile;
  contests: Contest[];
  leagues: League[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  rosters: Roster[];
  leaderboard: LeaderboardEntry[];
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  inventory: UserInventory;
  cosmetics: CosmeticItem[];
  badges: Badge[];
}

export interface PredictionFeedPayload {
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  results: PredictionResult[];
}

export interface PredictionPagePayload {
  profile: Profile;
  teams: Team[];
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  results: PredictionResult[];
}

export interface InventoryPagePayload {
  profile: Profile;
  inventory: UserInventory;
  cosmetics: CosmeticItem[];
  badges: Badge[];
}

export interface RosterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  teamCount: Record<ID, number>;
}

export interface BuildRosterInput {
  starterPlayerIds: ID[];
  substitutePlayerIds: ID[];
  captainPlayerId: ID;
  viceCaptainPlayerId: ID;
}

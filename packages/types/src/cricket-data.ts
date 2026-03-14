export type CricketMatchFormat = "t20" | "odi" | "test";
export type CricketMatchStatus = "upcoming" | "live" | "completed" | "abandoned";

export interface CricketDataMatch {
  id: string;
  name: string;
  short_name: string;
  series_id: string;
  series_name: string;
  format: CricketMatchFormat;
  status: CricketMatchStatus;
  start_time: string;
  end_time?: string;
  venue: string;
  city?: string;
  country?: string;
  home_team: CricketDataTeam;
  away_team: CricketDataTeam;
  toss?: {
    winner: string;
    decision: "bat" | "bowl";
  };
  result?: {
    winner: string;
    margin: string;
    type: "runs" | "wickets";
  };
  score?: {
    home: CricketDataInnings[];
    away: CricketDataInnings[];
  };
}

export interface CricketDataInnings {
  runs: number;
  wickets: number;
  overs: number;
  declared?: boolean;
  forfeited?: boolean;
}

export interface CricketDataTeam {
  id: string;
  name: string;
  short_name: string;
  logo_url?: string;
}

export interface CricketDataPlayer {
  id: string;
  name: string;
  short_name?: string;
  team_id: string;
  team_name: string;
  role: "WK" | "BAT" | "AR" | "BOWL";
  batting_style?: "RHB" | "LHB";
  bowling_style?: string;
  image_url?: string;
  country?: string;
  credits?: number;
  selection_percent?: number;
}

export interface CricketDataSeries {
  id: string;
  name: string;
  short_name?: string;
  type: "tournament" | "series" | "league";
  start_date: string;
  end_date: string;
  status: "upcoming" | "live" | "completed";
  matches_count: number;
}

export interface CricketDataBall {
  over: number;
  ball: number;
  runs: number;
  extras: number;
  type: "run" | "boundary" | "six" | "wicket" | "wide" | "no-ball" | "dot";
  batsman_id: string;
  batsman_name: string;
  bowler_id: string;
  bowler_name: string;
  dismissal_type?: string;
  fielder_name?: string;
  commentary?: string;
}

export interface CricketDataScorecard {
  match_id: string;
  innings: CricketDataInningsScorecard[];
}

export interface CricketDataInningsScorecard {
  batting_team: string;
  bowling_team: string;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  extras: number;
  batting: CricketDataBattingPerformance[];
  bowling: CricketDataBowlingPerformance[];
  fall_of_wickets: CricketDataFallOfWicket[];
}

export interface CricketDataBattingPerformance {
  player_id: string;
  player_name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  out: boolean;
  dismissal?: string;
  bowler?: string;
  fielder?: string;
}

export interface CricketDataBowlingPerformance {
  player_id: string;
  player_name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dots: number;
}

export interface CricketDataFallOfWicket {
  wicket: number;
  runs: number;
  overs: string;
  player_name: string;
}

export interface CricketDataSquad {
  team_id: string;
  team_name: string;
  players: CricketDataPlayer[];
}

export interface CricketDataLiveScore {
  match_id: string;
  current_innings: number;
  batting_team: string;
  bowling_team: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  recent_balls: CricketDataBall[];
  required_run_rate?: number;
  current_run_rate: number;
  target?: number;
  batsmen: {
    striker: CricketDataBatsmanLive;
    non_striker: CricketDataBatsmanLive;
  };
  bowler: CricketDataBowlerLive;
}

export interface CricketDataBatsmanLive {
  player_id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}

export interface CricketDataBowlerLive {
  player_id: string;
  name: string;
  overs: number;
  wickets: number;
  runs: number;
  maidens: number;
}

export interface CricketDataAPIResponse<T> {
  data: T;
  status: "success" | "error";
  message?: string;
  hits_remaining?: number;
  hits_limit?: number;
}
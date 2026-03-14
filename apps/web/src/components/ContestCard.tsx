import { useEffect, useMemo, useState } from "react";
import { Copy, Shield, ShieldAlert, Star, TrendingUp, Users } from "lucide-react";

import type { BuildRosterInput, Contest, LeaderboardEntry, Match, Player, Roster, Team } from "@fantasy-cricket/types";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ContestCardProps {
  contest: Contest;
  match: Match;
  teams: Team[];
  players: Player[];
  leaderboard: LeaderboardEntry[];
  existingRoster?: Roster;
  onSubmit: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
}

function defaultSelection(players: Player[]) {
  return players.slice(0, 11).map((player) => player.id);
}

export function ContestCard({
  contest,
  match,
  teams,
  players,
  leaderboard,
  existingRoster,
  onSubmit
}: ContestCardProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [captainPlayerId, setCaptainPlayerId] = useState("");
  const [viceCaptainPlayerId, setViceCaptainPlayerId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const basePlayers = existingRoster?.players.map((entry) => entry.playerId) ?? defaultSelection(players);
    setSelectedPlayerIds(basePlayers);
    setCaptainPlayerId(existingRoster?.captainPlayerId ?? basePlayers[0] ?? "");
    setViceCaptainPlayerId(existingRoster?.viceCaptainPlayerId ?? basePlayers[1] ?? "");
  }, [existingRoster, players]);

  const selectedPlayers = useMemo(
    () => players.filter((player) => selectedPlayerIds.includes(player.id)),
    [players, selectedPlayerIds]
  );
  
  const salaryUsed = selectedPlayers.reduce((sum, player) => sum + player.credits, 0);
  const homeTeam = teams.find((team) => team.id === match.homeTeamId);
  const awayTeam = teams.find((team) => team.id === match.awayTeamId);

  async function handleSubmit() {
    setStatus(null);
    try {
      await onSubmit(contest.id, {
        playerIds: selectedPlayerIds,
        captainPlayerId,
        viceCaptainPlayerId
      });
      setStatus("Roster successfully saved! 🎉");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save roster. Please try again.");
    }
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= contest.rosterRules.totalPlayers) {
        return current;
      }
      return [...current, playerId];
    });
  }

  const isFull = selectedPlayerIds.length === contest.rosterRules.totalPlayers;
  const capRemaining = contest.salaryCap - salaryUsed;

  return (
    <Card className="glass-panel border-white/10 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -z-10" />
      
      <CardHeader className="border-b border-white/5 pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase tracking-widest text-[10px] font-bold">
                {contest.kind} Contest
              </Badge>
              {existingRoster && (
                <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20">
                  Joined
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl md:text-3xl font-black tracking-tight">{contest.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 text-sm font-medium">
              <Shield className="w-4 h-4 text-primary" />
              {homeTeam?.name} <span className="text-muted-foreground font-normal mx-1">vs</span> {awayTeam?.name}
              <span className="mx-2 text-border">•</span>
              Locks in: {new Date(contest.lockTime).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </CardDescription>
          </div>
          
          <div className="flex flex-wrap gap-2 md:gap-4 lg:flex-nowrap bg-background/50 p-3 rounded-2xl border border-white/5">
            <div className="flex flex-col px-3 border-r border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Salary Cap</span>
              <span className="font-bold text-foreground">{contest.salaryCap}</span>
            </div>
            <div className="flex flex-col px-3 border-r border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Selected</span>
              <span className={`font-bold ${isFull ? 'text-primary' : 'text-foreground'}`}>
                {selectedPlayerIds.length}<span className="text-muted-foreground text-xs font-normal">/{contest.rosterRules.totalPlayers}</span>
              </span>
            </div>
            <div className="flex flex-col px-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Rem. Credits</span>
              <span className={`font-bold ${capRemaining < 0 ? 'text-destructive' : 'text-secondary'}`}>
                {capRemaining.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          
          {/* Player Selection Area */}
          <div className="lg:col-span-8 p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Draft Your Squad
              </h4>
            </div>
            
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {players.map((player) => {
                  const active = selectedPlayerIds.includes(player.id);
                  const isHome = player.teamId === match.homeTeamId;
                  
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => togglePlayer(player.id)}
                      className={`
                        relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left overflow-hidden group
                        ${active 
                          ? "bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(34,197,94,0.15)] z-10" 
                          : "bg-background/40 border-white/5 hover:border-white/20 hover:bg-background/80"
                        }
                      `}
                    >
                      {active && <div className="absolute inset-y-0 left-0 w-1 bg-primary" />}
                      
                      <Avatar className={`w-10 h-10 border-2 ${isHome ? 'border-primary/50' : 'border-secondary/50'}`}>
                        <AvatarFallback className="bg-background text-xs font-bold">
                          {player.name.substring(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${active ? 'text-primary-foreground' : 'text-foreground'}`}>
                          {player.name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className="uppercase font-semibold tracking-wider">{player.role.slice(0,3)}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-foreground/80 font-medium">Cr {player.credits}</span>
                        </p>
                      </div>
                      
                      <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center shrink-0 border
                        ${active 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'bg-transparent border-border text-transparent group-hover:border-primary/50 group-hover:bg-primary/10'
                        }
                      `}>
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={active ? "opacity-100" : "opacity-0"}>
                          <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Configuration & Leaderboard Area */}
          <div className="lg:col-span-4 bg-background/30 flex flex-col">
            <div className="p-6 space-y-6 flex-1 border-b border-white/5">
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Star className="w-4 h-4 text-secondary" />
                  Designate Leaders
                </h4>
                
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground ml-1">Captain (2x Points)</label>
                    <select 
                      className="w-full h-11 px-3 bg-background border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      value={captainPlayerId} 
                      onChange={(e) => setCaptainPlayerId(e.target.value)}
                    >
                      <option value="" disabled>Select Captain</option>
                      {selectedPlayers.map((player) => (
                        <option key={`c-${player.id}`} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground ml-1">Vice Captain (1.5x Points)</label>
                    <select 
                      className="w-full h-11 px-3 bg-background border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      value={viceCaptainPlayerId} 
                      onChange={(e) => setViceCaptainPlayerId(e.target.value)}
                    >
                      <option value="" disabled>Select Vice Captain</option>
                      {selectedPlayers.map((player) => (
                        <option key={`vc-${player.id}`} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmit} 
                  className="w-full h-12 mt-4 font-bold text-base glow-effect hover:scale-[1.02] transition-transform"
                >
                  Confirm Roster
                </Button>
                
                {status && (
                  <div className={`p-3 rounded-lg text-sm font-medium text-center flex items-center justify-center gap-2 border ${
                    status.includes("failed") 
                      ? "bg-destructive/10 text-destructive border-destructive/20" 
                      : "bg-primary/10 text-primary border-primary/20"
                  }`}>
                    {status.includes("failed") ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    {status}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 flex-1 bg-black/20">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4" />
                Live Leaderboard
              </h4>
              
              <ScrollArea className="h-[200px]">
                {leaderboard.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 py-10">
                    <Copy className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm font-medium">No active rosters yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {leaderboard.map((entry, index) => (
                      <div 
                        key={entry.id} 
                        className={`
                          flex items-center justify-between p-3 rounded-xl border
                          ${index < 3 
                            ? 'bg-secondary/10 border-secondary/20 text-secondary' 
                            : 'bg-background/50 border-white/5 text-foreground'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-black text-lg w-6 text-center ${index === 0 ? 'text-yellow-500' : ''}`}>
                            {entry.rank}
                          </span>
                          <span className="font-medium truncate max-w-[120px]">{entry.userId.substring(0,8)}...</span>
                        </div>
                        <span className="font-bold font-mono tracking-tight">{entry.points.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}

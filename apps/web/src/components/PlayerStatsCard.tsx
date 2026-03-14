import { useState } from "react";
import { TrendingUp, TrendingDown, MapPin, Users, BarChart3, Flame, Snowflake } from "lucide-react";
import type { Player, PlayerStats, Team, FormIndicator } from "@fantasy-cricket/types";

interface PlayerStatsCardProps {
  player: Player;
  stats: PlayerStats;
  team?: Team;
  oppositionTeam?: Team;
  venue?: string;
  onClose: () => void;
}

export function PlayerStatsCard({ player, stats, team, oppositionTeam, venue, onClose }: PlayerStatsCardProps) {
  const [activeTab, setActiveTab] = useState<"form" | "records">("form");

  const formColors: Record<FormIndicator, { bg: string; text: string; icon: React.ReactNode }> = {
    hot: { bg: "bg-orange-500/20", text: "text-orange-400", icon: <Flame className="w-4 h-4" /> },
    good: { bg: "bg-green-500/20", text: "text-green-400", icon: <TrendingUp className="w-4 h-4" /> },
    average: { bg: "bg-slate-500/20", text: "text-slate-400", icon: <BarChart3 className="w-4 h-4" /> },
    cold: { bg: "bg-blue-500/20", text: "text-blue-400", icon: <Snowflake className="w-4 h-4" /> }
  };

  const form = formColors[stats.form];
  
  const maxLastFive = Math.max(...stats.lastFiveMatches, 1);

  const vsTeamRecord = oppositionTeam ? stats.vsTeam[oppositionTeam.id] : null;
  const venueRecord = venue ? stats.venueRecord[venue] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div 
        className="card p-0 max-w-md w-full max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-4 ${form.bg}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{player.name}</h2>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${form.bg} ${form.text}`}>
                  {form.icon}
                  {stats.form.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span>{team?.name}</span>
                <span>•</span>
                <span>{player.role}</span>
                {player.nationality === "indian-uncapped" && (
                  <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-[10px] rounded font-bold">UNCAPPED</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-black text-accent">{stats.totalPoints}</div>
              <div className="text-xs text-text-muted">Total Pts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black">{stats.averagePoints.toFixed(1)}</div>
              <div className="text-xs text-text-muted">Avg Pts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black">{player.selectionPercent}%</div>
              <div className="text-xs text-text-muted">Selected</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("form")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "form" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"}`}
            >
              Recent Form
            </button>
            <button
              onClick={() => setActiveTab("records")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "records" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text"}`}
            >
              Records
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[300px]">
          {activeTab === "form" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Last 5 Matches</h4>
                <div className="flex gap-2">
                  {stats.lastFiveMatches.map((pts, i) => (
                    <div key={i} className="flex-1">
                      <div 
                        className="h-20 rounded-lg flex items-end justify-center pb-1 transition-all"
                        style={{ 
                          background: `linear-gradient(to top, ${pts > 30 ? "rgba(34, 197, 94, 0.3)" : pts > 15 ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.05)"})`,
                        }}
                      >
                        <span className={`font-bold text-sm ${pts > 30 ? "text-accent" : ""}`}>{pts}</span>
                      </div>
                      <div className="text-[10px] text-text-muted text-center mt-1">M{i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-surface-elevated">
                  <div className="text-xs text-text-muted mb-1">Highest Score</div>
                  <div className="text-xl font-bold text-accent">{stats.highestScore}</div>
                </div>
                <div className="p-3 rounded-lg bg-surface-elevated">
                  <div className="text-xs text-text-muted mb-1">Credits</div>
                  <div className="text-xl font-bold">{player.credits}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "records" && (
            <div className="space-y-4">
              {vsTeamRecord && (
                <div className="p-3 rounded-lg bg-surface-elevated">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-text-muted uppercase">vs {oppositionTeam?.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-text-muted">Matches</div>
                      <div className="font-bold">{vsTeamRecord.matches}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted">Avg Points</div>
                      <div className={`font-bold ${vsTeamRecord.avgPoints > stats.averagePoints ? "text-accent" : ""}`}>
                        {vsTeamRecord.avgPoints.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {venueRecord && (
                <div className="p-3 rounded-lg bg-surface-elevated">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-text-muted uppercase">at {venue}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-text-muted">Matches</div>
                      <div className="font-bold">{venueRecord.matches}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted">Avg Points</div>
                      <div className={`font-bold ${venueRecord.avgPoints > stats.averagePoints ? "text-accent" : ""}`}>
                        {venueRecord.avgPoints.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!vsTeamRecord && !venueRecord && (
                <div className="text-center py-8 text-text-muted">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No specific records available</p>
                </div>
              )}

              {player.nationality === "indian-uncapped" && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="text-xs font-bold text-accent uppercase mb-1">Uncapped Bonus</div>
                  <p className="text-sm text-text-muted">This player is uncapped. Selecting them gives you bonus points!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
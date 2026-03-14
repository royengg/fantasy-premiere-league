import type { Player, Team } from "@fantasy-cricket/types";

interface PlayerCardProps {
  player: Player;
  team?: Team;
  isSelected: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  selectionPercent?: number;
  recentForm?: number[];
  onToggle: () => void;
  onSetCaptain?: () => void;
  onSetViceCaptain?: () => void;
  disabled?: boolean;
}

export function PlayerCard({ 
  player, 
  team, 
  isSelected, 
  isCaptain, 
  isViceCaptain,
  selectionPercent = 45,
  recentForm = [12, 8, 23, 45, 15],
  onToggle,
  onSetCaptain,
  onSetViceCaptain,
  disabled 
}: PlayerCardProps) {
  const avgPoints = recentForm.reduce((a, b) => a + b, 0) / recentForm.length;
  const lastMatch = recentForm[recentForm.length - 1];
  
  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    WK: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
    BAT: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" },
    AR: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
    BOWL: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" }
  };
  
  const colors = roleColors[player.role] || roleColors.BAT;

  return (
    <div 
      className={`
        relative rounded-xl border transition-all duration-200 overflow-hidden
        ${isSelected ? `${colors.bg} ${colors.border}` : "bg-surface-card border-border hover:border-accent/30"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
      onClick={!disabled ? onToggle : undefined}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />
      )}
      
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center border ${colors.border}`}>
              <span className={`text-lg font-bold ${colors.text}`}>
                {player.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            {(isCaptain || isViceCaptain) && (
              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCaptain ? "bg-yellow-500 text-black" : "bg-slate-400 text-black"}`}>
                {isCaptain ? "C" : "VC"}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{player.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${colors.bg} ${colors.text}`}>
                {player.role}
              </span>
            </div>
            <p className="text-xs text-text-muted truncate">{team?.name}</p>
            
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="text-text-muted">
                <span className="text-foreground font-semibold">{player.credits}</span> cr
              </span>
              <span className="text-text-muted">
                <span className="text-foreground font-semibold">{selectionPercent}%</span> selected
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold text-accent">{avgPoints.toFixed(0)}</div>
            <div className="text-[10px] text-text-muted">avg pts</div>
          </div>
        </div>
        
        <div className="mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">Last 5:</span>
              <div className="flex gap-0.5">
                {recentForm.map((pts, i) => (
                  <div 
                    key={i}
                    className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-medium ${
                      pts > 30 ? "bg-accent/20 text-accent" : 
                      pts > 15 ? "bg-accent/10 text-accent" : 
                      "bg-surface text-text-muted"
                    }`}
                  >
                    {pts}
                  </div>
                ))}
              </div>
            </div>
            
            {isSelected && (
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onSetCaptain?.(); }}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                    isCaptain 
                      ? "bg-yellow-500 text-black" 
                      : "bg-surface hover:bg-yellow-500/20 text-text-muted hover:text-yellow-400"
                  }`}
                >
                  C
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSetViceCaptain?.(); }}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                    isViceCaptain 
                      ? "bg-slate-400 text-black" 
                      : "bg-surface hover:bg-slate-500/20 text-text-muted hover:text-slate-400"
                  }`}
                >
                  VC
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
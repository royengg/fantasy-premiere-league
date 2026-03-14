import { useState, useEffect } from "react";
import type { BallEvent, LiveMatchData, Player } from "@fantasy-cricket/types";

interface LiveScoreboardProps {
  liveData: LiveMatchData;
  players: Player[];
  onBallEvent?: (event: BallEvent) => void;
}

export function LiveScoreboard({ liveData, players, onBallEvent }: LiveScoreboardProps) {
  const [animatingBall, setAnimatingBall] = useState<BallEvent | null>(null);
  const [lastWicket, setLastWicket] = useState<BallEvent | null>(null);

  useEffect(() => {
    if (liveData.recentBalls.length > 0) {
      const latestBall = liveData.recentBalls[0];
      if (latestBall.type === "wicket") {
        setLastWicket(latestBall);
        setTimeout(() => setLastWicket(null), 3000);
      }
      setAnimatingBall(latestBall);
      setTimeout(() => setAnimatingBall(null), 1000);
    }
  }, [liveData.recentBalls]);

  const getBatsmanName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name.split(" ").slice(-1)[0] || "Batsman";
  };

  const getBowlerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name.split(" ").slice(-1)[0] || "Bowler";
  };

  const getBallColor = (type: BallEvent["type"]) => {
    switch (type) {
      case "wicket": return "bg-red-500";
      case "six": return "bg-purple-500";
      case "boundary": return "bg-accent";
      case "dot": return "bg-slate-500";
      default: return "bg-slate-400";
    }
  };

  const getBallDisplay = (event: BallEvent) => {
    switch (event.type) {
      case "wicket": return "W";
      case "six": return "6";
      case "boundary": return "4";
      case "wide": return "Wd";
      case "no-ball": return "Nb";
      case "dot": return "•";
      default: return event.runs.toString();
    }
  };

  return (
    <div className="relative">
      {lastWicket && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-500/20 backdrop-blur-sm animate-pulse">
          <div className="text-center">
            <div className="text-4xl font-black text-red-500 mb-2">WICKET!</div>
            <div className="text-sm text-text-muted">{lastWicket.description}</div>
          </div>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-black">
              {liveData.score}<span className="text-lg text-text-muted">/{liveData.wickets}</span>
            </div>
            <div className="text-lg text-text-muted">({liveData.overs})</div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-text-muted">Innings {liveData.innings}</div>
            {liveData.target && (
              <div className="text-sm">Need <span className="font-bold text-accent">{liveData.target - liveData.score}</span> from <span className="font-bold">{(20 - parseFloat(liveData.overs)) * 6}</span> balls</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-3 border-y border-border">
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-2">Batsmen</div>
            <div className="space-y-2">
              {liveData.currentBatsmen.map((b, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${i === 0 ? "text-accent" : ""}`}>
                      {getBatsmanName(b.playerId)}
                    </span>
                    {i === 0 && <span className="text-xs text-text-muted">*</span>}
                  </div>
                  <span className="font-bold">{b.runs}<span className="text-text-muted text-xs ml-1">({b.balls})</span></span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-2">Bowler</div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{getBowlerName(liveData.currentBowler.playerId)}</span>
              <span className="font-bold">
                {liveData.currentBowler.wickets}/{liveData.currentBowler.runs}
                <span className="text-text-muted text-xs ml-1">({liveData.currentBowler.overs})</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-text-muted uppercase">Partnership</div>
            <div className="font-bold">{liveData.partnership.runs}<span className="text-xs text-text-muted">({liveData.partnership.balls})</span></div>
          </div>
          <div>
            <div className="text-xs text-text-muted uppercase">CRR</div>
            <div className="font-bold text-accent">{liveData.currentRunRate.toFixed(2)}</div>
          </div>
          {liveData.requiredRunRate && (
            <div>
              <div className="text-xs text-text-muted uppercase">RRR</div>
              <div className={`font-bold ${liveData.requiredRunRate > 12 ? "text-red-400" : liveData.requiredRunRate > 10 ? "text-orange-400" : "text-accent"}`}>
                {liveData.requiredRunRate.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-text-muted uppercase tracking-wider mb-2">This Over</div>
          <div className="flex gap-1.5">
            {liveData.recentBalls.slice(0, 6).reverse().map((ball, i) => (
              <div
                key={i}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${getBallColor(ball.type)}
                  ${animatingBall?.over === ball.over && animatingBall?.ball === ball.ball ? "animate-bounce" : ""}
                  ${ball.type === "wicket" ? "text-white" : "text-surface"}
                `}
              >
                {getBallDisplay(ball)}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 6 - liveData.recentBalls.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="w-8 h-8 rounded-full border border-dashed border-border/50" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
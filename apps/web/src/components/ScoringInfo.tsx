import { useState } from "react";
import { Info, X, Target, Zap, Users, Shield } from "lucide-react";

export function ScoringInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-accent transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        <span>Scoring System</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div 
            className="card p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Fantasy Scoring System</h2>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/5 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-green-400" />
                  </div>
                  <h3 className="font-bold">Batting Points</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Per run scored</span>
                    <span className="font-bold text-accent">+1</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Boundary (4)</span>
                    <span className="font-bold text-accent">+1</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Six (6)</span>
                    <span className="font-bold text-accent">+2</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">30+ runs</span>
                    <span className="font-bold text-accent">+4</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Half-century (50)</span>
                    <span className="font-bold text-accent">+8</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Century (100)</span>
                    <span className="font-bold text-accent">+16</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-text-muted">Duck (0)</span>
                    <span className="font-bold text-red-400">-2</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3 className="font-bold">Bowling Points</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Per wicket</span>
                    <span className="font-bold text-accent">+25</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Maiden over</span>
                    <span className="font-bold text-accent">+12</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Dot ball</span>
                    <span className="font-bold text-accent">+1</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">3 wicket haul</span>
                    <span className="font-bold text-accent">+8</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">5 wicket haul</span>
                    <span className="font-bold text-accent">+16</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-text-muted">LBW / Bowled</span>
                    <span className="font-bold text-accent">+8</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-bold">Fielding Points</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Catch</span>
                    <span className="font-bold text-accent">+8</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Stumping (WK)</span>
                    <span className="font-bold text-accent">+12</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Run out (direct)</span>
                    <span className="font-bold text-accent">+12</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-text-muted">Run out (assist)</span>
                    <span className="font-bold text-accent">+6</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-yellow-400" />
                  </div>
                  <h3 className="font-bold">Captaincy Bonus</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-text-muted">Captain</span>
                    <span className="font-bold text-yellow-400">2x Points</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-text-muted">Vice Captain</span>
                    <span className="font-bold text-slate-400">1.5x Points</span>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-accent/10 text-xs text-text-muted">
                  <p><strong className="text-accent">Pro Tip:</strong> Pick an all-rounder as captain for maximum points from both batting and bowling!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
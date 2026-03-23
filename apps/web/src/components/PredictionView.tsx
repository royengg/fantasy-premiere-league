import { useState } from "react";
import { Target, Clock, Star, CheckCircle, Flame } from "lucide-react";
import type { PredictionAnswer, PredictionQuestion, Team } from "@fantasy-cricket/types";
import { getTeamPalette } from "../lib/team-branding";

interface PredictionViewProps {
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  streak: number;
  teams: Team[];
  onAnswer: (questionId: string, optionId: string) => Promise<unknown>;
}

export function PredictionView({ questions, answers, streak, teams, onAnswer }: PredictionViewProps) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const teamPaletteById = new Map(
    teams.map((team) => {
      const palette = getTeamPalette(team);
      return [team.id, palette] as const;
    })
  );

  const handleAnswer = async (qid: string, oid: string) => {
    setSubmitting(qid);
    try {
      await onAnswer(qid, oid);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div 
        className="card p-4 sm:p-6"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='%2322c55e' fill-opacity='0.02'/%3E%3C/svg%3E\")" }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-accent" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Predictions</span>
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">Match Predictions</h2>
            <p className="text-text-muted text-sm mt-1">Answer correctly to earn XP and unlock rewards.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="stat-block">
              <Flame className="w-5 h-5 text-accent mb-1" />
              <span className="stat-value text-accent">{streak}</span>
              <span className="stat-label">Streak</span>
            </div>
            <div className="stat-block">
              <Target className="w-5 h-5 text-accent mb-1" />
              <span className="stat-value">{answers.length}</span>
              <span className="stat-label">Answered</span>
            </div>
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-white/5 border border-border flex items-center justify-center mx-auto mb-4">
            <Target className="w-10 h-10 text-text-muted/50" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Predictions Available</h2>
          <p className="text-text-muted">Check back closer to matchday.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {questions.map(q => {
            const answer = answers.find(a => a.questionId === q.id);
            const answered = !!answer;
            const locked = new Date(q.locksAt) < new Date();
            const loading = submitting === q.id;

            return (
              <div 
                key={q.id} 
                className={`card p-5 transition-colors ${answered ? "border-accent/30" : ""}`}
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='15' fill='none' stroke='%2322c55e' stroke-opacity='0.03' stroke-width='1'/%3E%3C/svg%3E\")" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="badge">{q.category.replace("-", " ")}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-accent">
                    <Star className="w-3 h-3" />+{q.xpReward} XP
                  </span>
                </div>
                <h3 className="font-semibold mb-2">{q.prompt}</h3>
                <p className="flex items-center gap-1 text-xs text-text-muted mb-4">
                  <Clock className="w-3 h-3" />
                  {locked ? "Locked" : `Locks ${new Date(q.locksAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                </p>
                <div className="space-y-2">
                  {q.options.map(opt => {
                    const selected = answer?.optionId === opt.id;
                    const teamPalette =
                      q.category === "winner" ? teamPaletteById.get(opt.value) : undefined;
                    const optionLabel = teamPalette?.team.name ?? opt.label;
                    const teamStyle = teamPalette
                      ? {
                          borderColor: `${teamPalette.primary}55`,
                          background: `linear-gradient(135deg, ${teamPalette.primary}16, ${teamPalette.secondary}10)`
                        }
                      : undefined;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !answered && !locked && handleAnswer(q.id, opt.id)}
                        disabled={answered || locked || loading}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                          selected
                            ? teamPalette
                              ? "font-semibold"
                              : "bg-accent text-surface border-accent font-semibold"
                            : answered || locked
                              ? "bg-surface-elevated border-border opacity-60 cursor-not-allowed"
                              : "bg-surface-elevated border-border hover:border-accent/50"
                        }`}
                        style={teamStyle ? teamStyle : undefined}
                      >
                        <span
                          className="font-medium"
                          style={selected && teamPalette ? { color: teamPalette.primary } : undefined}
                        >
                          {optionLabel}
                        </span>
                        {selected && (
                          <CheckCircle
                            className="w-4 h-4"
                            style={teamPalette ? { color: teamPalette.primary } : undefined}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

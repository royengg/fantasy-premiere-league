import { useState } from "react";
import { Brain, Clock, Zap, CheckCircle } from "lucide-react";
import type { PredictionAnswer, PredictionQuestion } from "@fantasy-cricket/types";

interface PredictionViewProps {
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  streak: number;
  onAnswer: (questionId: string, optionId: string) => Promise<unknown>;
}

export function PredictionView({ questions, answers, streak, onAnswer }: PredictionViewProps) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  const handleAnswer = async (qid: string, oid: string) => {
    setSubmitting(qid);
    try {
      await onAnswer(qid, oid);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="card-hero card-hero-blue p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-accent-blue" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent-blue">Forecast</span>
            </div>
            <h2 className="text-2xl font-bold">Predictions</h2>
            <p className="text-text-muted text-sm mt-1">Answer correctly to earn XP and unlock rewards.</p>
          </div>
          <div className="flex gap-3">
            <div className="stat-block">
              <span className="stat-value text-accent-orange">{streak}</span>
              <span className="stat-label">Streak</span>
            </div>
            <div className="stat-block">
              <span className="stat-value text-accent-blue">{answers.length}</span>
              <span className="stat-label">Answered</span>
            </div>
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-10 h-10 text-text-muted/50" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Predictions Available</h2>
          <p className="text-text-muted">Check back closer to matchday.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {questions.map(q => {
            const answer = answers.find(a => a.questionId === q.id);
            const answered = !!answer;
            const locked = new Date(q.locksAt) < new Date();
            const loading = submitting === q.id;

            return (
              <div key={q.id} className={`card-hero p-5 transition-colors ${answered ? "border-accent-green/30" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="badge bg-accent-blue/10 text-accent-blue border-accent-blue/20">{q.category.replace("-", " ")}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-accent-orange">
                    <Zap className="w-3 h-3" />+{q.xpReward} XP
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
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !answered && !locked && handleAnswer(q.id, opt.id)}
                        disabled={answered || locked || loading}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                          selected
                            ? "bg-accent-green text-surface border-accent-green font-semibold"
                            : answered || locked
                              ? "bg-surface-elevated border-border/30 opacity-60 cursor-not-allowed"
                              : "bg-surface-elevated border-border/30 hover:border-accent-blue/50"
                        }`}
                      >
                        {opt.label}
                        {selected && <CheckCircle className="w-4 h-4" />}
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
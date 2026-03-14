import { Brain, CheckCircle2, Clock, Swords, Trophy, Sparkles } from "lucide-react";
import type { PredictionAnswer, PredictionQuestion } from "@fantasy-cricket/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PredictionPanelProps {
  questions: PredictionQuestion[];
  answers: PredictionAnswer[];
  onAnswer: (questionId: string, optionId: string) => Promise<unknown>;
}

export function PredictionPanel({ questions, answers, onAnswer }: PredictionPanelProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-secondary/10 p-6 rounded-3xl border border-secondary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] -z-10" />
        <div className="space-y-2 relative z-10">
          <Badge variant="outline" className="text-secondary border-secondary/30 uppercase tracking-widest text-[10px]">
            Crystal Ball
          </Badge>
          <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-secondary" />
            Season Predictions
          </h3>
          <p className="text-muted-foreground mt-1 max-w-xl">
            Lock in your boldest takes. Earn XP, extend your streak, and unlock exclusive cosmetics. No cash value, purely for prestige and bragging rights.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {questions.map((question) => {
          const answer = answers.find((entry) => entry.questionId === question.id);
          const isAnswered = !!answer;

          return (
            <Card key={question.id} className={`
              glass-panel transition-all duration-300 relative overflow-hidden group
              ${isAnswered ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-secondary/30'}
            `}>
              {isAnswered && (
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-[40px] pointer-events-none" />
              )}
              
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="bg-background/50 text-foreground border-white/10 text-[10px] uppercase font-bold tracking-wider rounded-lg px-2">
                    {question.category === 'player-performance' ? <Trophy className="w-3 h-3 mr-1 inline" /> : <Swords className="w-3 h-3 mr-1 inline" />}
                    {question.category.replace("-", " ")}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg border border-secondary/20">
                    <Sparkles className="w-3 h-3" />
                    +{question.xpReward} XP
                  </div>
                </div>
                
                <CardTitle className="text-lg font-bold leading-snug">
                  {question.prompt}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-2 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Locks in: {new Date(question.locksAt).toLocaleString(undefined, { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-2.5 relative">
                  {question.options.map((option) => {
                    const isSelected = answer?.optionId === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => !isAnswered && onAnswer(question.id, option.id)}
                        disabled={isAnswered}
                        className={`
                          w-full group/btn flex items-center justify-between p-3.5 rounded-xl border transition-all text-left
                          ${isSelected 
                            ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_15px_rgba(34,197,94,0.3)] font-bold scale-[1.02]" 
                            : isAnswered
                              ? "bg-background/20 border-white/5 opacity-50 cursor-not-allowed text-muted-foreground"
                              : "bg-background/40 border-white/10 hover:border-secondary/50 hover:bg-secondary/10 text-foreground font-medium"
                          }
                        `}
                      >
                        <span className="truncate pr-4">{option.label}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 shrink-0 animate-in zoom-in duration-300" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
              
              {isAnswered && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-emerald-400" />
              )}
            </Card>
          );
        })}

        {questions.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <Card className="glass-panel border-dashed border-white/20 bg-background/30">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                  <Brain className="w-10 h-10 text-secondary opacity-80" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Questions</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  The crystal ball is cloudy. Check back closer to matchday for new multiplier and scenario predictions.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

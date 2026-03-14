import { Archive, Asterisk, Award, CheckCircle2, ChevronRight, PaintBucket, Shield, Sparkles } from "lucide-react";
import type { Badge as BadgeType, CosmeticItem, Profile, UserInventory } from "@fantasy-cricket/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LockerPanelProps {
  inventory: UserInventory;
  cosmetics: CosmeticItem[];
  badges: BadgeType[];
  profile: Profile;
  onEquip: (cosmeticId: string) => Promise<unknown>;
}

export function LockerPanel({ inventory, cosmetics, badges, profile, onEquip }: LockerPanelProps) {
  const unlockedCosmetics = cosmetics.filter((item) => inventory.cosmeticIds.includes(item.id));
  const unlockedBadges = badges.filter((badge) => inventory.badgeIds.includes(badge.id));

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "LEGENDARY": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      case "EPIC": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      case "RARE": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-primary/5 p-6 rounded-3xl border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -z-10" />
        <div className="space-y-2 relative z-10 w-full">
          <Badge variant="outline" className="text-primary border-primary/30 uppercase tracking-widest text-[10px]">
            Trophy Cabinet
          </Badge>
          <div className="flex flex-col md:flex-row justify-between w-full md:items-end gap-4">
            <div>
              <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                <PaintBucket className="w-8 h-8 text-primary" />
                Cosmetics & Badges
              </h3>
              <p className="text-muted-foreground mt-1 max-w-xl">
                Show off your achievements with exclusive visual upgrades. These items are strictly cosmetic—zero impact on fantasy performance.
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex flex-col p-3 rounded-2xl bg-background/50 border border-white/5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Level</span>
                <span className="text-xl font-bold flex items-center gap-2">
                  <Asterisk className="w-5 h-5 text-secondary" />
                  {profile.level}
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-2xl bg-background/50 border border-white/5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total XP</span>
                <span className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {profile.xp.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cosmetics Section (Main Content) */}
        <div className="lg:col-span-8 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-2">
            <Archive className="w-4 h-4" />
            Your Collection
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {unlockedCosmetics.length === 0 ? (
              <Card className="sm:col-span-2 xl:col-span-3 glass-panel border-dashed border-white/20 bg-background/30">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full border border-dashed border-primary/50 flex items-center justify-center mb-6">
                    <PaintBucket className="w-8 h-8 text-primary opacity-50 relative top-0.5 right-0.5" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Cosmetics Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Keep predicting correctly and ranking up in leagues to earn exclusive themes and avatars.
                  </p>
                </CardContent>
              </Card>
            ) : (
              unlockedCosmetics.map((item) => {
                const isEquipped = profile.equippedCosmetics[item.category] === item.id;
                
                return (
                  <Card 
                    key={item.id} 
                    className={`
                      glass-panel transition-all duration-300 relative overflow-hidden group flex flex-col h-full
                      ${isEquipped ? 'border-primary shadow-[0_4px_20px_rgba(34,197,94,0.15)] bg-gradient-to-b from-primary/10 to-transparent' : 'border-white/10 hover:border-white/30'}
                    `}
                  >
                    {isEquipped && (
                      <div className="absolute top-3 right-3 z-10">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    
                    {/* Visual Preview */}
                    <div className="h-32 mb-2 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                      <div className="absolute inset-0 opacity-20" style={{ background: item.themeToken }} />
                      <div 
                        className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center relative z-10 border border-white/20"
                        style={{ background: item.themeToken }}
                      >
                        <Shield className="w-8 h-8 text-white/50" />
                      </div>
                    </div>
                    
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <CardTitle className="text-base font-bold truncate leading-tight">{item.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className={`text-[9px] uppercase tracking-widest border-0 font-bold px-0 w-fit ${getRarityColor(item.rarity)} px-2 py-0.5`}>
                        {item.rarity}
                      </Badge>
                    </CardHeader>
                    
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground flex-grow">
                      {item.description}
                    </CardContent>
                    
                    <CardFooter className="p-4 pt-0 mt-auto">
                      <Button 
                        onClick={() => onEquip(item.id)}
                        disabled={isEquipped}
                        variant={isEquipped ? "outline" : "default"}
                        className={`w-full font-bold h-9 text-xs transition-all ${isEquipped ? 'border-primary text-primary opacity-100' : 'glow-effect'}`}
                      >
                        {isEquipped ? 'Equipped' : 'Equip Item'}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Badges Section (Sidebar) */}
        <div className="lg:col-span-4 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-2">
            <Award className="w-4 h-4" />
            Earned Badges
          </h4>
          
          <div className="bg-background/40 border border-white/5 rounded-3xl p-6 min-h-[400px]">
            {unlockedBadges.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <div className="w-16 h-16 rounded-full bg-secondary/5 flex items-center justify-center mb-4">
                  <Award className="w-8 h-8 text-secondary/30" />
                </div>
                <h3 className="text-base font-bold mb-1">Badge Case Empty</h3>
                <p className="text-xs text-muted-foreground">
                  Finish in top brackets to fill your case.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unlockedBadges.map((badge) => (
                  <div 
                    key={badge.id}
                    className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20 hover:scale-[1.02] transition-transform"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30 shadow-[0_0_15px_rgba(248,160,79,0.3)]">
                      <Award className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{badge.label}</h4>
                      <p className="text-xs text-muted-foreground leading-snug mt-1">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Locked Badges Hint */}
                <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between text-xs text-muted-foreground font-medium px-2 group cursor-pointer hover:text-foreground transition-colors">
                  <span>View unearned badges</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

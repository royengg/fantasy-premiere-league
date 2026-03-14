import { useState } from "react";
import { Package, Award, Lock, Check, Zap, Crown } from "lucide-react";
import type { Badge as BadgeType, CosmeticItem, Profile, UserInventory } from "@fantasy-cricket/types";

interface LockerViewProps {
  inventory: UserInventory;
  cosmetics: CosmeticItem[];
  badges: BadgeType[];
  profile: Profile;
  onEquip: (cosmeticId: string) => Promise<unknown>;
}

export function LockerView({ inventory, cosmetics, badges, profile, onEquip }: LockerViewProps) {
  const [equipping, setEquipping] = useState<string | null>(null);
  
  const ownedCosmetics = cosmetics.filter(c => inventory.cosmeticIds.includes(c.id));
  const ownedBadges = badges.filter(b => inventory.badgeIds.includes(b.id));

  const handleEquip = async (id: string) => {
    setEquipping(id);
    try {
      await onEquip(id);
    } finally {
      setEquipping(null);
    }
  };

  const rarityStyle: Record<string, string> = {
    epic: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    rare: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    common: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
  };

  return (
    <div className="space-y-8">
      <div className="card-hero card-hero-purple p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-accent-purple" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent-purple">Collection</span>
            </div>
            <h2 className="text-2xl font-bold">Locker Room</h2>
            <p className="text-text-muted text-sm mt-1">Your earned cosmetics and badges.</p>
          </div>
          <div className="flex gap-3">
            <div className="stat-block">
              <Crown className="w-5 h-5 text-accent-gold mb-1" />
              <span className="stat-value">{profile.level}</span>
              <span className="stat-label">Level</span>
            </div>
            <div className="stat-block">
              <Zap className="w-5 h-5 text-accent-green mb-1" />
              <span className="stat-value">{profile.xp.toLocaleString()}</span>
              <span className="stat-label">XP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Package className="w-4 h-4" />Cosmetics ({ownedCosmetics.length})
          </h3>
          
          {ownedCosmetics.length === 0 ? (
            <div className="card-hero border-dashed border-border/50 text-center py-16">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-text-muted/50" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Cosmetics Yet</h3>
              <p className="text-text-muted text-sm">Earn through predictions and contests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ownedCosmetics.map(item => {
                const equipped = profile.equippedCosmetics[item.category] === item.id;
                const loading = equipping === item.id;
                return (
                  <div key={item.id} className={`card-hero overflow-hidden ${equipped ? "border-accent-green/50" : ""}`}>
                    <div className="h-24 relative flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${item.themeToken}20, transparent)` }}>
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: item.themeToken }}>
                        <Package className="w-6 h-6 text-white/70" />
                      </div>
                      {equipped && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent-green flex items-center justify-center">
                          <Check className="w-3 h-3 text-surface" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold">{item.name}</h4>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${rarityStyle[item.rarity] || rarityStyle.common}`}>
                          {item.rarity}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mb-3">{item.description}</p>
                      <button
                        onClick={() => handleEquip(item.id)}
                        disabled={equipped || loading}
                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                          equipped
                            ? "bg-accent-green/10 text-accent-green border border-accent-green/30"
                            : "btn-primary py-2"
                        }`}
                      >
                        {loading ? <span className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin inline-block" /> : equipped ? "Equipped" : "Equip"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Award className="w-4 h-4" />Badges ({ownedBadges.length})
          </h3>
          
          <div className="card-hero p-4">
            {ownedBadges.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Award className="w-6 h-6 text-text-muted/50" />
                </div>
                <p className="text-sm text-text-muted">No badges earned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ownedBadges.map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent-orange/10 border border-accent-orange/20">
                    <div className="w-10 h-10 rounded-full bg-accent-orange/20 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-accent-orange" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm">{b.label}</h4>
                      <p className="text-xs text-text-muted truncate">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
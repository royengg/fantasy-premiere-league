import { useState } from "react";
import { Package, Award, Lock, Check, Star, Crown, Shirt } from "lucide-react";
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
    rare: "text-accent bg-accent/10 border-accent/20",
    common: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
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
              <Package className="w-5 h-5 text-accent" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Collection</span>
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">Locker Room</h2>
            <p className="text-text-muted text-sm mt-1">Your earned cosmetics and badges.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="stat-block">
              <Crown className="w-5 h-5 text-accent mb-1" />
              <span className="stat-value">{profile.level}</span>
              <span className="stat-label">Level</span>
            </div>
            <div className="stat-block">
              <Star className="w-5 h-5 text-accent mb-1" />
              <span className="stat-value">{profile.xp.toLocaleString()}</span>
              <span className="stat-label">XP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Shirt className="w-4 h-4" />Cosmetics ({ownedCosmetics.length})
          </h3>
          
          {ownedCosmetics.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-border flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-text-muted/50" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Cosmetics Yet</h3>
              <p className="text-text-muted text-sm">Earn through predictions and contests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ownedCosmetics.map(item => {
                const equipped = profile.equippedCosmetics[item.category] === item.id;
                const loading = equipping === item.id;
                return (
                  <div 
                    key={item.id} 
                    className={`card overflow-hidden ${equipped ? "border-accent/30" : ""}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='5' y='5' width='30' height='30' rx='4' fill='${encodeURIComponent(item.themeToken)}' fill-opacity='0.05'/%3E%3C/svg%3E")` }}
                  >
                    <div className="h-24 relative flex items-center justify-center border-b border-border" style={{ background: `linear-gradient(135deg, ${item.themeToken}15, transparent)` }}>
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center border border-white/10" style={{ background: item.themeToken }}>
                        <Shirt className="w-6 h-6 text-white/80" />
                      </div>
                      {equipped && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
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
                            ? "bg-accent/10 text-accent border border-accent/30"
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
          
          <div 
            className="card p-4"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='20,5 35,35 5,35' fill='none' stroke='%2322c55e' stroke-opacity='0.03' stroke-width='1'/%3E%3C/svg%3E\")" }}
          >
            {ownedBadges.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-border flex items-center justify-center mx-auto mb-3">
                  <Award className="w-6 h-6 text-text-muted/50" />
                </div>
                <p className="text-sm text-text-muted">No badges earned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ownedBadges.map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-accent" />
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

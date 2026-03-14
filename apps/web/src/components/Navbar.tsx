import { LogOut, Star } from "lucide-react";

interface NavbarProps {
  username: string;
  xp: number;
  level: number;
  onLogout: () => void;
}

export function Navbar({ username, xp, level, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-sm font-black text-surface">FPL</span>
          </div>
          <div>
            <span className="font-bold text-sm">Fantasy Premier League</span>
            <span className="hidden sm:inline text-text-muted text-xs ml-2">IPL 2026</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-border">
            <Star className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold">{xp.toLocaleString()} XP</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{username}</p>
              <p className="text-xs text-text-muted">Level {level}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent">
              {username.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-text-muted hover:text-text"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
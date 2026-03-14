import { LogOut, Zap } from "lucide-react";

interface NavbarProps {
  username: string;
  xp: number;
  level: number;
  onLogout: () => void;
}

export function Navbar({ username, xp, level, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-green to-accent-green/60 flex items-center justify-center">
            <span className="text-lg font-black text-surface">FC</span>
          </div>
          <div>
            <span className="font-bold text-sm">Fantasy Club</span>
            <span className="hidden sm:inline text-text-muted text-xs ml-2">Season 1</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
            <Zap className="w-4 h-4 text-accent-green" />
            <span className="text-sm font-bold">{xp.toLocaleString()}</span>
            <span className="text-xs text-text-muted">XP</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{username}</p>
              <p className="text-xs text-text-muted">Level {level}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-orange to-accent-orange/60 flex items-center justify-center text-sm font-bold text-surface">
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
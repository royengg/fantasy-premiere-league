import { LucideIcon, Users, Trophy, Target, Package } from "lucide-react";

interface NavigationCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  stats: { value: number | string; label: string };
  onClick: () => void;
}

const cardBg = `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='40' cy='40' r='30' fill='none' stroke='%2322c55e' stroke-opacity='0.04' stroke-width='2'/%3E%3Ccircle cx='40' cy='40' r='8' fill='%2322c55e' fill-opacity='0.03'/%3E%3C/svg%3E")`;

export function NavigationCard({ title, subtitle, icon: Icon, stats, onClick }: NavigationCardProps) {
  return (
    <button
      onClick={onClick}
      className="card card-interactive w-full text-left p-6 relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ backgroundImage: cardBg }}
    >
      <div className="flex items-start justify-between mb-8">
        <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-accent" />
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-accent">{stats.value}</span>
          <span className="block text-xs text-text-muted">{stats.label}</span>
        </div>
      </div>
      
      <h2 className="text-xl font-bold mb-1">{title}</h2>
      <p className="text-text-muted text-sm">{subtitle}</p>
      
      <div className="mt-6 flex items-center gap-2 text-text-muted text-sm font-medium">
        <span>Enter</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </div>
    </button>
  );
}
import { LucideIcon, Swords, Trophy, Brain, Package } from "lucide-react";

interface NavigationCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: "green" | "orange" | "blue" | "purple";
  stats: { value: number | string; label: string };
  onClick: () => void;
}

const accentConfig = {
  green: {
    cardClass: "card-hero-green card-glow-green",
    iconBg: "bg-accent-green/20",
    iconColor: "text-accent-green",
    textClass: "text-gradient-green",
    statBg: "bg-accent-green/10",
    statText: "text-accent-green"
  },
  orange: {
    cardClass: "card-hero-orange card-glow-orange",
    iconBg: "bg-accent-orange/20",
    iconColor: "text-accent-orange",
    textClass: "text-gradient-orange",
    statBg: "bg-accent-orange/10",
    statText: "text-accent-orange"
  },
  blue: {
    cardClass: "card-hero-blue card-glow-blue",
    iconBg: "bg-accent-blue/20",
    iconColor: "text-accent-blue",
    textClass: "text-gradient-blue",
    statBg: "bg-accent-blue/10",
    statText: "text-accent-blue"
  },
  purple: {
    cardClass: "card-hero-purple card-glow-purple",
    iconBg: "bg-accent-purple/20",
    iconColor: "text-accent-purple",
    textClass: "text-accent-purple",
    statBg: "bg-accent-purple/10",
    statText: "text-accent-purple"
  }
};

export function NavigationCard({ title, subtitle, icon: Icon, accent, stats, onClick }: NavigationCardProps) {
  const config = accentConfig[accent];
  
  return (
    <button
      onClick={onClick}
      className={`card-hero ${config.cardClass} p-6 w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green`}
    >
      <div className="flex items-start justify-between mb-8">
        <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center`}>
          <Icon className={`w-7 h-7 ${config.iconColor}`} />
        </div>
        <div className={`px-3 py-1.5 rounded-lg ${config.statBg}`}>
          <span className={`text-xl font-extrabold ${config.statText}`}>{stats.value}</span>
          <span className="text-xs text-text-muted ml-1">{stats.label}</span>
        </div>
      </div>
      
      <h2 className="text-2xl font-extrabold mb-1">{title}</h2>
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
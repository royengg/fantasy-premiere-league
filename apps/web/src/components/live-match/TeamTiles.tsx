import type { Team } from "@fantasy-cricket/types";
import { teamDescriptor, readableTextColor } from "./utils";

interface TeamTileProps {
  align: "left" | "right";
  primary: string;
  team: Team;
}

interface CompactMatchupCardProps {
  awayColor: string;
  awayTeam: Team;
  homeColor: string;
  homeTeam: Team;
}

export function CompactMatchupCard({
  awayColor,
  awayTeam,
  homeColor,
  homeTeam,
}: CompactMatchupCardProps) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(53,81,97,0.52),rgba(30,45,56,0.7))] p-2.5 shadow-[0_18px_46px_rgba(0,0,0,0.3)] backdrop-blur-md">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <CompactTeamTile team={homeTeam} primary={homeColor} />
        <div className="text-center text-[1.7rem] font-black tracking-[-0.06em] text-white/14">
          VS
        </div>
        <CompactTeamTile team={awayTeam} primary={awayColor} />
      </div>
    </div>
  );
}

export function TeamTile({ align, primary, team }: TeamTileProps) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.15rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-24 sm:w-24 sm:rounded-[1.4rem] lg:h-28 lg:w-28"
        style={{
          backgroundColor: primary,
          borderColor: `${primary}55`,
          boxShadow: `0 22px 48px ${primary}35`,
        }}
      >
        <span
          className="text-[1.6rem] font-black italic tracking-[-0.05em] sm:text-[2rem] lg:text-[2.2rem]"
          style={{ color: readableTextColor(primary) }}
        >
          {team.shortName}
        </span>
      </div>
      <p className="mt-3 text-base font-black text-white sm:mt-4 sm:text-xl">
        {teamDescriptor(team)}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/40 sm:text-sm">
        {team.city}
      </p>
    </div>
  );
}

export function CompactTeamTile({ primary, team }: { primary: string; team: Team }) {
  return (
    <div className="min-w-0 text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-[0.9rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          backgroundColor: primary,
          borderColor: `${primary}55`,
          boxShadow: `0 16px 36px ${primary}30`,
        }}
      >
        <span
          className="text-[1rem] font-black italic tracking-[-0.05em]"
          style={{ color: readableTextColor(primary) }}
        >
          {team.shortName}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-black leading-4 text-white">{teamDescriptor(team)}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-white/40">
        {team.city}
      </p>
    </div>
  );
}

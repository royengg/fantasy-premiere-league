import type { Team } from "@fantasy-cricket/types";

interface TeamBadgeProps {
  team?: Team;
  primary?: string;
  align?: "left" | "right";
}

export function TeamBadge({ team, primary, align = "left" }: TeamBadgeProps) {
  const shortName = team?.shortName?.toUpperCase() ?? "TBD";
  const isRightAligned = align === "right";

  return (
    <div
      className={`flex min-w-0 items-center gap-2 sm:gap-3 ${
        isRightAligned ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      <div
        className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center text-xs font-black sm:h-12 sm:w-12 sm:text-sm ${
          isRightAligned ? "order-2 sm:order-none" : ""
        }`}
        style={{
          background: primary ? `${primary}18` : "rgba(34, 197, 94, 0.12)",
          borderColor: primary ? `${primary}44` : "rgba(34, 197, 94, 0.24)",
          color: primary ?? "#22c55e",
        }}
      >
        {shortName}
      </div>
      <div className={`min-w-0 ${isRightAligned ? "order-1 sm:order-none" : ""}`}>
        <p className="whitespace-normal break-words text-[10px] font-semibold leading-[1.05rem] text-text sm:text-sm sm:leading-tight">
          {team?.name ?? "Team TBD"}
        </p>
        <p className="hidden text-[11px] uppercase tracking-[0.18em] text-text-muted sm:block">
          {team?.city ?? "IPL"}
        </p>
      </div>
    </div>
  );
}

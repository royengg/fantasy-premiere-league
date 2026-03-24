import type { Player } from "@fantasy-cricket/types";

interface SectionPanelProps {
  title: string;
  subtitle: string;
  players: Player[];
  roleTone: "starter" | "bench";
  onRemove: (playerId: string) => void;
  onMove?: (playerId: string) => void;
  moveLabel?: string;
}

export function SectionPanel({ title, subtitle, players, roleTone, onRemove, onMove, moveLabel }: SectionPanelProps) {
  return (
    <div className="card bg-surface-elevated p-4">
      <div className="mb-3">
        <h4 className="font-semibold">{title}</h4>
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {players.length > 0 ? (
          players.map((player) => (
            <div key={player.id} className="flex flex-col gap-3 rounded-xl bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm">{player.name}</div>
                <div className="text-xs text-text-muted">{player.role}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${roleTone === "bench" ? "bg-amber-500/15 text-amber-300" : ""}`}>
                  {roleTone === "starter" ? "XI" : "SUB"}
                </span>
                {onMove && moveLabel ? (
                  <button type="button" onClick={() => onMove(player.id)} className="btn-secondary !px-3 !py-2 !text-xs">
                    {moveLabel}
                  </button>
                ) : null}
                <button type="button" onClick={() => onRemove(player.id)} className="btn-secondary !px-3 !py-2 !text-xs">
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-text-muted">No players added yet.</div>
        )}
      </div>
    </div>
  );
}

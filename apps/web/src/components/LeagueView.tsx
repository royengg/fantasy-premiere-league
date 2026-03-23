import { useMemo, useState } from "react";
import { ArrowRight, Globe2, Plus, Trophy, Users } from "lucide-react";

import type { League } from "@fantasy-cricket/types";

interface LeagueViewProps {
  currentUserId: string;
  leagues: League[];
  onCreate: (payload: {
    name: string;
    description?: string;
    visibility: "public" | "private";
    maxMembers: number;
  }) => Promise<League>;
  onJoin: (inviteCode: string) => Promise<League>;
  onOpenLeague: (leagueId: string) => void;
}

export function LeagueView({
  currentUserId,
  leagues,
  onCreate,
  onJoin,
  onOpenLeague
}: LeagueViewProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [maxMembers, setMaxMembers] = useState(8);
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const publicLeagues = useMemo(
    () => leagues.filter((league) => league.visibility === "public"),
    [leagues]
  );
  const privateLeagues = useMemo(
    () =>
      leagues.filter(
        (league) => league.visibility === "private" && league.memberIds.includes(currentUserId)
      ),
    [currentUserId, leagues]
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);

    try {
      const league = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        maxMembers
      });
      setName("");
      setDescription("");
      setVisibility("private");
      setMaxMembers(8);
      onOpenLeague(league.id);
    } catch (error) {
      setStatus({
        ok: false,
        message: error instanceof Error ? error.message : "Could not create league."
      });
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);

    try {
      const league = await onJoin(inviteCode.trim().toUpperCase());
      setInviteCode("");
      onOpenLeague(league.id);
    } catch (error) {
      setStatus({
        ok: false,
        message: error instanceof Error ? error.message : "Could not join private league."
      });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                League Hub
              </span>
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">Leagues</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              Browse public season leagues or spin up a private room with friends. Private leagues
              jump straight into a waiting lobby and start their auction automatically when every
              joined manager is ready.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <LeagueMetric label="Public" value={`${publicLeagues.length}`} />
            <LeagueMetric label="Private" value={`${privateLeagues.length}`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-accent" />
                <h3 className="text-lg font-bold">Public Leagues</h3>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                Open season leagues anyone can join from the listing.
              </p>
            </div>
            <span className="badge">{publicLeagues.length} live</span>
          </div>

          {publicLeagues.length ? (
            <div className="space-y-3">
              {publicLeagues.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => onOpenLeague(league.id)}
                  className="w-full rounded-2xl border border-border bg-surface-elevated p-4 text-left transition-colors hover:border-accent/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{league.name}</div>
                      <p className="mt-1 text-sm text-text-muted">
                        {league.description || "Public season-long league with a league auction and locked squads."}
                      </p>
                    </div>
                    <span className="badge">public</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-muted">
                    <span>{league.memberIds.length}/{league.maxMembers} managers</span>
                    <span>{league.squadSize}-player squads</span>
                    <span>{league.auctionRoomId ? "Lobby ready" : "Session opens on entry"}</span>
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                    Open league
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 text-sm text-text-muted">
              No public leagues are listed right now.
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" />
            <h3 className="text-lg font-bold">Create League</h3>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="League name"
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
              required
            />

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              className="min-h-28 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-elevated p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  Visibility
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["private", "public"] as const).map((option) => {
                    const active = visibility === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setVisibility(option)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition-colors ${
                          active
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-surface text-text-muted hover:border-accent/35"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface-elevated p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                    Max Seats
                  </span>
                  <span className="text-lg font-bold text-accent">{maxMembers}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={15}
                  value={maxMembers}
                  onChange={(event) => setMaxMembers(Number(event.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                  <span>2</span>
                  <span>15</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-4 text-sm text-text-muted">
              {visibility === "private"
                ? "Private leagues open a party lobby right away. Share the code, fill the seats, and the auction starts automatically when every joined manager is ready."
                : "Public leagues are listed in the open directory. Players can enter the session from the listing, fill the seats, and the auction starts automatically once the room is ready."}
            </div>

            <button type="submit" disabled={!name.trim()} className="btn-primary w-full">
              Create {visibility} league
            </button>
          </form>

          <div className="my-5 h-px bg-border" />

          <form onSubmit={handleJoin} className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h4 className="font-semibold">Join with party code</h4>
            </div>

            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="Invite code"
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-mono uppercase tracking-[0.16em] outline-none focus:border-accent"
              required
            />

            <button type="submit" disabled={!inviteCode.trim()} className="btn-secondary w-full">
              Join private league
            </button>
          </form>

          {privateLeagues.length ? (
            <div className="mt-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                Your private leagues
              </div>
              {privateLeagues.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => onOpenLeague(league.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-left transition-colors hover:border-accent/35"
                >
                  <div>
                    <div className="font-semibold">{league.name}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      Code {league.inviteCode} • {league.memberIds.length}/{league.maxMembers} managers
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-accent" />
                </button>
              ))}
            </div>
          ) : null}

          {status ? (
            <div
              className={`mt-5 rounded-xl border p-3 text-sm ${
                status.ok
                  ? "border-accent/20 bg-accent/10 text-accent"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function LeagueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-block min-w-[96px]">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

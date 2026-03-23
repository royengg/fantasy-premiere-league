import { useState } from "react";

import type { Team } from "@fantasy-cricket/types";
import { getDisplayTeam, getTeamPalette } from "../lib/team-branding";

interface OnboardingScreenProps {
  name: string;
  initialUsername: string;
  initialFavoriteTeamId?: string;
  teams: Team[];
  onSubmit: (payload: { username: string; favoriteTeamId: string }) => Promise<unknown>;
}

export function OnboardingScreen({
  name,
  initialUsername,
  initialFavoriteTeamId,
  teams,
  onSubmit
}: OnboardingScreenProps) {
  const [username, setUsername] = useState(initialUsername);
  const [favoriteTeamId, setFavoriteTeamId] = useState(
    initialFavoriteTeamId ?? teams[0]?.id ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayTeams = teams.map((team) => getDisplayTeam(team));
  const selectedTeam = displayTeams.find((team) => team.id === favoriteTeamId);
  const selectedPalette = selectedTeam ? getTeamPalette(selectedTeam) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ username, favoriteTeamId });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not complete onboarding."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface bg-grid bg-radial flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-5 sm:p-8">
        <p className="text-accent text-xs font-bold uppercase tracking-widest mb-3">
          First-Time Setup
        </p>
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Finish your profile, {name.split(" ")[0]}
        </h1>
        <p className="text-text-muted mb-6">
          Choose the username and favorite team you want other league members to see.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1.5 h-12 px-4 bg-surface border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="CaptainAisha"
              required
            />
            <p className="mt-2 text-xs text-text-muted">
              Use letters, numbers, or underscores only.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Favorite Team
            </label>
            <select
              value={favoriteTeamId}
              onChange={(e) => setFavoriteTeamId(e.target.value)}
              className="w-full mt-1.5 h-12 px-4 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-accent transition-colors"
              required
            >
              {displayTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.shortName})
                </option>
              ))}
            </select>
            {selectedTeam && selectedPalette ? (
              <div
                className="mt-3 rounded-2xl border p-4"
                style={{
                  borderColor: `${selectedPalette.primary}44`,
                  background: `linear-gradient(135deg, ${selectedPalette.primary}16, ${selectedPalette.secondary}10)`
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted mb-2">
                  Current Favorite
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl border flex items-center justify-center text-sm font-black"
                    style={{
                      background: `${selectedPalette.primary}18`,
                      borderColor: `${selectedPalette.primary}44`,
                      color: selectedPalette.primary
                    }}
                  >
                    {selectedTeam.shortName}
                  </div>
                  <div>
                    <p className="font-semibold text-text">{selectedTeam.name}</p>
                    <p className="text-sm text-text-muted">{selectedTeam.city}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                Saving profile...
              </span>
            ) : (
              "Complete Setup"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

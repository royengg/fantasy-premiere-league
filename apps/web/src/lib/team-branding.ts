import { getIplTeamBranding, normalizeIplTeam } from "@fantasy-cricket/domain";
import type { Team } from "@fantasy-cricket/types";

const FALLBACK_PALETTES = [
  { primary: "#2563EB", secondary: "#60A5FA", accent: "#93C5FD" },
  { primary: "#EA580C", secondary: "#FDBA74", accent: "#FED7AA" },
  { primary: "#16A34A", secondary: "#86EFAC", accent: "#BBF7D0" },
  { primary: "#A21CAF", secondary: "#E879F9", accent: "#F0ABFC" }
] as const;

export function getDisplayTeam(team: Team) {
  return normalizeIplTeam(team);
}

export function getTeamPalette(team: Team) {
  const displayTeam = getDisplayTeam(team);
  const branding = getIplTeamBranding(displayTeam);

  if (branding) {
    return {
      team: displayTeam,
      primary: branding.primary,
      secondary: branding.secondary,
      accent: branding.accent
    };
  }

  const fallback =
    FALLBACK_PALETTES[displayTeam.name.length % FALLBACK_PALETTES.length];

  return {
    team: displayTeam,
    primary: fallback.primary,
    secondary: fallback.secondary,
    accent: fallback.accent
  };
}

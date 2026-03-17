import type { Team } from "@fantasy-cricket/types";

export interface IplTeamBranding {
  key: string;
  name: string;
  shortName: string;
  city: string;
  primary: string;
  secondary: string;
  accent: string;
  aliases: string[];
}

const IPL_TEAM_BRANDINGS: Record<string, IplTeamBranding> = {
  MI: {
    key: "MI",
    name: "Mumbai Indians",
    shortName: "MI",
    city: "Mumbai",
    primary: "#004BA0",
    secondary: "#D4A83D",
    accent: "#7DB7FF",
    aliases: ["mumbai", "mum", "mumbaiindians", "mumbaitides"]
  },
  CSK: {
    key: "CSK",
    name: "Chennai Super Kings",
    shortName: "CSK",
    city: "Chennai",
    primary: "#F5D000",
    secondary: "#1E5AA8",
    accent: "#FFF2A8",
    aliases: ["chennai", "chennaisuperkings"]
  },
  RCB: {
    key: "RCB",
    name: "Royal Challengers Bengaluru",
    shortName: "RCB",
    city: "Bengaluru",
    primary: "#D71920",
    secondary: "#0F2D5C",
    accent: "#C8A44D",
    aliases: [
      "bengaluru",
      "bangalore",
      "royalchallengersbengaluru",
      "royalchallengersbangalore",
      "bengalurublaze",
      "ben"
    ]
  },
  KKR: {
    key: "KKR",
    name: "Kolkata Knight Riders",
    shortName: "KKR",
    city: "Kolkata",
    primary: "#4B1F6F",
    secondary: "#D4AF37",
    accent: "#B88CFF",
    aliases: ["kolkata", "kolkataknightriders"]
  },
  RR: {
    key: "RR",
    name: "Rajasthan Royals",
    shortName: "RR",
    city: "Jaipur",
    primary: "#FF4FA3",
    secondary: "#21409A",
    accent: "#FFC3E0",
    aliases: ["rajasthan", "rajasthanroyals", "jaipur"]
  },
  SRH: {
    key: "SRH",
    name: "Sunrisers Hyderabad",
    shortName: "SRH",
    city: "Hyderabad",
    primary: "#F26522",
    secondary: "#111111",
    accent: "#FDBA74",
    aliases: ["hyderabad", "sunrisershyderabad"]
  },
  DC: {
    key: "DC",
    name: "Delhi Capitals",
    shortName: "DC",
    city: "Delhi",
    primary: "#17479E",
    secondary: "#E31E24",
    accent: "#8EB6FF",
    aliases: ["delhi", "delhicapitals", "delhidaredevils"]
  },
  GT: {
    key: "GT",
    name: "Gujarat Titans",
    shortName: "GT",
    city: "Ahmedabad",
    primary: "#1C274C",
    secondary: "#C7A76C",
    accent: "#8DA4E6",
    aliases: ["gujarat", "gujarattitans", "ahmedabad"]
  },
  PBKS: {
    key: "PBKS",
    name: "Punjab Kings",
    shortName: "PBKS",
    city: "Mohali",
    primary: "#D71920",
    secondary: "#C9A44D",
    accent: "#FF9EA2",
    aliases: ["punjab", "punjabkings", "kingsxipunjab", "kxip"]
  },
  LSG: {
    key: "LSG",
    name: "Lucknow Super Giants",
    shortName: "LSG",
    city: "Lucknow",
    primary: "#C62828",
    secondary: "#2563EB",
    accent: "#C9A44D",
    aliases: ["lucknow", "lucknowsupergiants"]
  }
};

function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const aliasLookup = new Map<string, IplTeamBranding>();

for (const branding of Object.values(IPL_TEAM_BRANDINGS)) {
  for (const alias of [
    branding.key,
    branding.shortName,
    branding.name,
    branding.city,
    ...branding.aliases
  ]) {
    aliasLookup.set(normalizeAlias(alias), branding);
  }
}

export function getIplTeamBranding(team: Pick<Team, "name" | "shortName"> | string) {
  if (typeof team === "string") {
    return aliasLookup.get(normalizeAlias(team));
  }

  return (
    aliasLookup.get(normalizeAlias(team.shortName)) ??
    aliasLookup.get(normalizeAlias(team.name))
  );
}

export function normalizeIplTeam<T extends Pick<Team, "name" | "shortName" | "city">>(team: T): T {
  const branding = getIplTeamBranding(team);

  if (!branding) {
    return team;
  }

  return {
    ...team,
    name: branding.name,
    shortName: branding.shortName,
    city: branding.city
  };
}

export const IPL_TEAMS = Object.values(IPL_TEAM_BRANDINGS);

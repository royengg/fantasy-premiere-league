import type { Match, Team } from "@fantasy-cricket/types";

export interface MatchCardData {
  accent: string;
  awayTeam: Team;
  awayColor: string;
  contestCount: number;
  homeTeam: Team;
  homeColor: string;
  id: string;
  startsAt: string;
  state: Match["state"];
  stateLabel: string;
  subtitle: string;
  title: string;
  venue: string;
}

export function matchStateLabel(match: Match) {
  if (match.state === "live") {
    return "Live Match";
  }

  if (match.state === "completed") {
    return "Match Final";
  }

  return "Upcoming Match";
}

export function matchSubtitle(match: Match) {
  const startsAt = new Date(match.startsAt);
  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(startsAt);
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(startsAt);

  if (match.state === "live") {
    return `The action is on at ${match.venue}. Lock in your fantasy XI and live winner calls now.`;
  }

  if (match.state === "completed") {
    return `The showdown at ${match.venue} is complete. Review the contest standings and settled predictions.`;
  }

  return `The next headline clash lands on ${formattedDate} at ${formattedTime}. Build your XI and lock predictions before the toss at ${match.venue}.`;
}

export function matchHeadline(card: MatchCardData) {
  if (card.state === "live") {
    return "The Rivalry Is Live";
  }

  if (card.state === "completed") {
    return "The Result Is In";
  }

  return "The Next Big Rivalry";
}

export function teamDescriptor(team: Team) {
  const withoutCity = team.name
    .replace(new RegExp(`^${team.city}\\s+`, "i"), "")
    .trim();
  if (!withoutCity || withoutCity === team.name) {
    const words = team.name.split(" ");
    return words.slice(-2).join(" ");
  }

  return withoutCity;
}

export function countdownParts(startsAt: string, now: number) {
  const remaining = Math.max(new Date(startsAt).getTime() - now, 0);
  const totalSeconds = Math.floor(remaining / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    mins: Math.floor((totalSeconds % 3_600) / 60),
    secs: totalSeconds % 60,
  };
}

export function metricLabel(card: MatchCardData) {
  if (card.state === "live") {
    return [
      { value: "LIVE", label: "Status" },
      { value: String(card.contestCount).padStart(2, "0"), label: "Contests" },
      { value: "NOW", label: "Window" },
      { value: "IPL", label: "Series" },
    ];
  }

  if (card.state === "completed") {
    return [
      { value: "FINAL", label: "Status" },
      { value: String(card.contestCount).padStart(2, "0"), label: "Contests" },
      { value: "DONE", label: "Result" },
      { value: "IPL", label: "Series" },
    ];
  }

  const countdown = countdownParts(card.startsAt, Date.now());
  return [
    { value: String(countdown.days).padStart(2, "0"), label: "Days" },
    { value: String(countdown.hours).padStart(2, "0"), label: "Hrs" },
    { value: String(countdown.mins).padStart(2, "0"), label: "Mins" },
    { value: String(countdown.secs).padStart(2, "0"), label: "Secs" },
  ];
}

export function readableTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#09202d" : "#ffffff";
}

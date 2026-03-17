import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Radio,
  TimerReset,
} from "lucide-react";

import type { Contest, Match, Team } from "@fantasy-cricket/types";
import { getTeamPalette } from "../lib/team-branding";

interface LiveMatchCarouselProps {
  contests: Contest[];
  matches: Match[];
  teams: Team[];
  onOpenContests?: () => void;
}

interface MatchCardData {
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

function matchStateLabel(match: Match) {
  if (match.state === "live") {
    return "Live Match";
  }

  if (match.state === "completed") {
    return "Match Final";
  }

  return "Upcoming Match";
}

function matchSubtitle(match: Match) {
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

function matchHeadline(card: MatchCardData) {
  if (card.state === "live") {
    return "The Rivalry Is Live";
  }

  if (card.state === "completed") {
    return "The Result Is In";
  }

  return "The Next Big Rivalry";
}

function teamDescriptor(team: Team) {
  const withoutCity = team.name
    .replace(new RegExp(`^${team.city}\\s+`, "i"), "")
    .trim();
  if (!withoutCity || withoutCity === team.name) {
    const words = team.name.split(" ");
    return words.slice(-2).join(" ");
  }

  return withoutCity;
}

function countdownParts(startsAt: string, now: number) {
  const remaining = Math.max(new Date(startsAt).getTime() - now, 0);
  const totalSeconds = Math.floor(remaining / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    mins: Math.floor((totalSeconds % 3_600) / 60),
    secs: totalSeconds % 60,
  };
}

function metricLabel(card: MatchCardData) {
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

export function LiveMatchCarousel({
  contests,
  matches,
  teams,
  onOpenContests,
}: LiveMatchCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  const cards = useMemo<MatchCardData[]>(() => {
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const contestCountByMatch = contests.reduce<Record<string, number>>(
      (accumulator, contest) => {
        accumulator[contest.matchId] = (accumulator[contest.matchId] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    return [...matches]
      .sort((left, right) => {
        const stateWeight = { live: 0, scheduled: 1, completed: 2 } as const;
        const leftWeight = stateWeight[left.state];
        const rightWeight = stateWeight[right.state];

        if (leftWeight !== rightWeight) {
          return leftWeight - rightWeight;
        }

        return (
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
        );
      })
      .map((match) => {
        const homeTeam = teamMap.get(match.homeTeamId);
        const awayTeam = teamMap.get(match.awayTeamId);

        if (!homeTeam || !awayTeam) {
          return null;
        }

        const homePalette = getTeamPalette(homeTeam);
        const awayPalette = getTeamPalette(awayTeam);

        return {
          id: match.id,
          title: `${homePalette.team.shortName} vs ${awayPalette.team.shortName}:`,
          subtitle: matchSubtitle(match),
          stateLabel: matchStateLabel(match),
          contestCount: contestCountByMatch[match.id] ?? 0,
          homeTeam: homePalette.team,
          awayTeam: awayPalette.team,
          homeColor: homePalette.primary,
          awayColor: awayPalette.primary,
          accent: homePalette.primary,
          startsAt: match.startsAt,
          state: match.state,
          venue: match.venue,
        };
      })
      .filter((entry): entry is MatchCardData => entry !== null)
      .slice(0, 8);
  }, [contests, matches, teams]);

  useEffect(() => {
    if (!cards.length) {
      return;
    }

    setActiveIndex((current) => Math.min(current, cards.length - 1));
  }, [cards.length]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  if (cards.length === 0) {
    return null;
  }

  const activeCard = cards[activeIndex];
  const metrics =
    activeCard.state === "scheduled"
      ? (() => {
          const countdown = countdownParts(activeCard.startsAt, now);
          return [
            { value: String(countdown.days).padStart(2, "0"), label: "Days" },
            { value: String(countdown.hours).padStart(2, "0"), label: "Hrs" },
            { value: String(countdown.mins).padStart(2, "0"), label: "Mins" },
            { value: String(countdown.secs).padStart(2, "0"), label: "Secs" },
          ];
        })()
      : metricLabel(activeCard);

  const goTo = (direction: "prev" | "next") => {
    setActiveIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? cards.length - 1 : current - 1;
      }

      return current === cards.length - 1 ? 0 : current + 1;
    });
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-accent text-xs font-bold uppercase tracking-widest mb-2">
            Match Center
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Live Matches
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo("prev")}
            className="w-11 h-11 rounded-2xl border border-border bg-surface-card text-text-muted hover:text-text hover:bg-white/5 transition-colors"
            aria-label="Show previous featured match"
          >
            <ChevronLeft className="w-5 h-5 mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => goTo("next")}
            className="w-11 h-11 rounded-2xl border border-border bg-surface-card text-text-muted hover:text-text hover:bg-white/5 transition-colors"
            aria-label="Show next featured match"
          >
            <ChevronRight className="w-5 h-5 mx-auto" />
          </button>
        </div>
      </div>

      <article
        className="relative overflow-hidden rounded-[2rem] border border-white/8 min-h-[620px] lg:min-h-[560px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(5, 17, 24, 0.98) 0%, rgba(8, 20, 27, 0.95) 48%, rgba(8, 35, 18, 0.98) 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 18% 34%, ${activeCard.homeColor}22 0%, transparent 34%), radial-gradient(circle at 82% 18%, ${activeCard.awayColor}24 0%, transparent 24%), linear-gradient(120deg, transparent 18%, rgba(255,255,255,0.03) 50%, transparent 78%)`,
          }}
        />

        <div className="absolute inset-x-0 bottom-0 h-[40%]">
          <div className="absolute inset-x-[8%] bottom-[18%] h-20 rounded-[100%] blur-3xl bg-[#6ee7b7]/10" />
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#123b1f]/95 via-[#13361d]/70 to-transparent" />
          <div
            className="absolute left-[8%] right-[8%] bottom-10 h-28 opacity-60"
            style={{
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 18px, transparent 18px 62px)",
              clipPath:
                "polygon(0% 100%, 8% 25%, 18% 0%, 31% 65%, 44% 20%, 56% 12%, 69% 72%, 82% 18%, 92% 30%, 100% 100%)",
            }}
          />
        </div>

        <div className="absolute right-8 top-8 hidden lg:block">
          <div className="relative w-56 h-56">
            <div className="absolute inset-0 rounded-full blur-3xl bg-white/25" />
            <div
              className="absolute inset-8 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.35) 42%, transparent 70%)",
              }}
            />
            <div className="absolute inset-0 grid grid-cols-4 gap-3 rotate-[-22deg]">
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={index}
                  className="w-4 h-4 rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.6)]"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] px-6 py-8 md:px-10 md:py-10 h-full">
          <div className="flex flex-col justify-between min-h-[540px] lg:min-h-[480px]">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] mb-6"
                style={{
                  color: activeCard.accent,
                  borderColor: `${activeCard.accent}45`,
                  background: `${activeCard.accent}12`,
                }}
              >
                {activeCard.state === "live" ? (
                  <Radio className="w-3.5 h-3.5" />
                ) : (
                  <TimerReset className="w-3.5 h-3.5" />
                )}
                {activeCard.stateLabel}
              </div>

              <div className="max-w-2xl">
                <h3 className="text-[3.1rem] sm:text-[4.1rem] md:text-[4.8rem] leading-[0.9] font-black tracking-[-0.05em] text-white">
                  {activeCard.title}
                </h3>
                <p
                  className="mt-3 text-[3rem] sm:text-[4rem] md:text-[4.5rem] leading-[0.9] font-black italic tracking-[-0.05em]"
                  style={{ color: activeCard.accent }}
                >
                  {matchHeadline(activeCard)}
                </p>
                <p className="mt-6 max-w-xl text-lg sm:text-xl leading-9 text-white/80">
                  {activeCard.subtitle}
                </p>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[1.4rem] border border-[#24445a] bg-[#081822]/72 backdrop-blur-sm px-4 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
                  >
                    <div
                      className="text-[2rem] font-black leading-none tracking-[-0.04em]"
                      style={{ color: activeCard.accent }}
                    >
                      {metric.value}
                    </div>
                    <div className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/35">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenContests}
                  className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-lg font-black uppercase tracking-tight text-[#06202c] transition-transform hover:-translate-y-0.5"
                  style={{
                    backgroundColor: activeCard.accent,
                    color: readableTextColor(activeCard.accent),
                    boxShadow: `0 14px 36px ${activeCard.accent}40`,
                  }}
                >
                  Join Now
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="text-sm text-white/50">
                  {activeCard.contestCount > 0
                    ? `${activeCard.contestCount} contest${activeCard.contestCount === 1 ? "" : "s"} live for this fixture`
                    : "Latest IPL fixture from the provider schedule"}
                  <span className="mx-2 text-white/25">|</span>
                  {activeCard.venue}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-[420px] rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(53,81,97,0.72),rgba(30,45,56,0.82))] p-6 sm:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <TeamTile
                  team={activeCard.homeTeam}
                  primary={activeCard.homeColor}
                  align="left"
                />

                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-black tracking-[-0.06em] text-white/10">
                    VS
                  </div>
                </div>

                <TeamTile
                  team={activeCard.awayTeam}
                  primary={activeCard.awayColor}
                  align="right"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute left-0 right-0 bottom-5 z-20 flex items-center justify-center gap-2">
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="h-2.5 rounded-full transition-all"
              style={{
                width: index === activeIndex ? 28 : 10,
                background:
                  index === activeIndex
                    ? activeCard.accent
                    : "rgba(255,255,255,0.18)",
              }}
              aria-label={`Show featured match ${index + 1}`}
            />
          ))}
        </div>
      </article>
    </section>
  );
}

interface TeamTileProps {
  align: "left" | "right";
  primary: string;
  team: Team;
}

function TeamTile({ align, primary, team }: TeamTileProps) {
  return (
    <div
      className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <div
        className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-[1.4rem] border flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          backgroundColor: primary,
          borderColor: `${primary}55`,
          boxShadow: `0 22px 48px ${primary}35`,
        }}
      >
        <span
          className="text-[2rem] sm:text-[2.2rem] font-black italic tracking-[-0.05em]"
          style={{ color: readableTextColor(primary) }}
        >
          {team.shortName}
        </span>
      </div>
      <p className="mt-4 text-xl font-black text-white">
        {teamDescriptor(team)}
      </p>
      <p className="mt-1 text-sm uppercase tracking-[0.16em] text-white/40">
        {team.city}
      </p>
    </div>
  );
}

function readableTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#09202d" : "#ffffff";
}

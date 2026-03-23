import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const [heroHeight, setHeroHeight] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  useLayoutEffect(() => {
    const updateHeroHeight = () => {
      const section = sectionRef.current;
      const controls = controlsRef.current;
      if (!section || !controls) {
        return;
      }

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const isMobile = window.innerWidth < 640;
      const bottomSafeSpace = isMobile ? 10 : window.innerWidth < 1024 ? 18 : 24;
      const sectionTop = section.getBoundingClientRect().top;
      const controlsHeight = controls.getBoundingClientRect().height;
      const controlsGap = isMobile ? 8 : 12;
      const availableSectionHeight = Math.floor(
        viewportHeight - sectionTop - bottomSafeSpace,
      );
      const maxHeight = isMobile ? 840 : window.innerWidth < 1024 ? 680 : 720;
      const measuredHeight = Math.max(
        availableSectionHeight - controlsHeight - controlsGap + (isMobile ? 64 : 0),
        260,
      );

      setHeroHeight(Math.min(measuredHeight, maxHeight));
    };

    updateHeroHeight();
    window.addEventListener("resize", updateHeroHeight);
    window.visualViewport?.addEventListener("resize", updateHeroHeight);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateHeroHeight())
        : null;

    if (controlsRef.current) {
      resizeObserver?.observe(controlsRef.current);
    }
    if (sectionRef.current) {
      resizeObserver?.observe(sectionRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateHeroHeight);
      window.visualViewport?.removeEventListener("resize", updateHeroHeight);
      resizeObserver?.disconnect();
    };
  }, [cards.length]);

  if (cards.length === 0) {
    return null;
  }

  const activeCard = cards[activeIndex];
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1280;
  const isMobile = viewportWidth < 640;
  const isCompact =
    isMobile || (heroHeight !== null && heroHeight < 540);
  const isUltraCompact =
    viewportWidth < 430 || (heroHeight !== null && heroHeight < 470);
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

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeDeltaRef.current = { x: 0, y: 0 };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (!swipeStartRef.current || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    swipeDeltaRef.current = {
      x: touch.clientX - swipeStartRef.current.x,
      y: touch.clientY - swipeStartRef.current.y,
    };
  };

  const handleTouchEnd = () => {
    const start = swipeStartRef.current;
    const delta = swipeDeltaRef.current;
    swipeStartRef.current = null;
    swipeDeltaRef.current = { x: 0, y: 0 };

    if (!start) {
      return;
    }

    const absX = Math.abs(delta.x);
    const absY = Math.abs(delta.y);

    if (absX < 44 || absX <= absY * 1.15) {
      return;
    }

    goTo(delta.x < 0 ? "next" : "prev");
  };

  return (
    <section ref={sectionRef} className="mb-6 sm:mb-8">
      <div ref={controlsRef} className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <div>
          <p className="text-accent mb-1.5 text-[10px] font-bold uppercase tracking-widest sm:mb-2 sm:text-xs">
            Match Center
          </p>
          <h2 className="text-lg font-extrabold tracking-tight sm:text-2xl">
            Live Matches
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo("prev")}
            className="h-10 w-10 rounded-2xl border border-border bg-surface-card text-text-muted transition-colors hover:bg-white/5 hover:text-text sm:h-11 sm:w-11"
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
        ref={articleRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative overflow-hidden rounded-[1.5rem] border border-white/8 sm:rounded-[1.75rem]"
        style={{
          height: heroHeight ? `${heroHeight}px` : undefined,
          touchAction: "pan-y",
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

        <div className="absolute inset-x-0 bottom-0 h-[38%] sm:h-[40%]">
          <div className="absolute inset-x-[8%] bottom-[18%] h-16 rounded-[100%] blur-3xl bg-[#6ee7b7]/10 sm:h-20" />
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#123b1f]/95 via-[#13361d]/70 to-transparent" />
          <div
            className="absolute bottom-8 left-[8%] right-[8%] h-20 opacity-60 sm:bottom-10 sm:h-28"
            style={{
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 18px, transparent 18px 62px)",
              clipPath:
                "polygon(0% 100%, 8% 25%, 18% 0%, 31% 65%, 44% 20%, 56% 12%, 69% 72%, 82% 18%, 92% 30%, 100% 100%)",
            }}
          />
        </div>

        {!isCompact ? (
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
        ) : null}

        <div
          className={`relative z-10 grid h-full ${
            isMobile
              ? isUltraCompact
                ? "gap-3 px-3 pt-3 pb-6"
                : "gap-3 px-3 pt-3 pb-7"
              : isCompact
                ? "gap-3 px-5 pt-5 pb-20"
                : "gap-6 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 sm:pb-20 md:px-10 md:pt-8 md:pb-22"
          } lg:grid-cols-[1.2fr_0.8fr]`}
        >
          <div
            className={`flex min-h-0 flex-col ${
              isMobile ? "justify-start" : "justify-between"
            } ${isCompact ? "gap-3 sm:gap-4" : "gap-5 sm:gap-6"}`}
          >
            <div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border font-bold uppercase tracking-[0.12em] ${
                  isCompact
                    ? "mb-3 px-2.5 py-1 text-[10px] sm:mb-4 sm:px-3 sm:py-1.5 sm:text-[11px]"
                    : "mb-4 px-3 py-1.5 text-[11px] sm:mb-5 sm:px-4 sm:py-2 sm:text-xs"
                }`}
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
                <h3
                  className={`leading-[0.94] font-black tracking-[-0.05em] text-white ${
                    isUltraCompact
                      ? "text-[1.55rem] sm:text-[2rem] md:text-[3rem] lg:text-[3.6rem]"
                      : isCompact
                        ? "text-[1.75rem] sm:text-[2.3rem] md:text-[3.4rem] lg:text-[4rem]"
                        : "text-[1.95rem] sm:text-[2.8rem] md:text-[4.1rem] lg:text-[4.8rem]"
                  }`}
                >
                  {activeCard.title}
                </h3>
                <p
                  className={`leading-[0.94] font-black italic tracking-[-0.05em] ${
                    isUltraCompact
                      ? "mt-1.5 text-[1.55rem] sm:mt-2 sm:text-[2rem] md:text-[2.9rem] lg:text-[3.4rem]"
                      : isCompact
                        ? "mt-2 text-[1.75rem] sm:text-[2.25rem] md:text-[3.2rem] lg:text-[3.7rem]"
                        : "mt-2 text-[1.95rem] sm:mt-3 sm:text-[2.8rem] md:text-[4rem] lg:text-[4.5rem]"
                  }`}
                  style={{ color: activeCard.accent }}
                >
                  {matchHeadline(activeCard)}
                </p>
                <p
                  className={`max-w-xl text-white/80 ${
                    isUltraCompact
                      ? "mt-2 text-xs leading-4.5 sm:text-sm sm:leading-5"
                      : isCompact
                        ? "mt-2.5 text-[13px] leading-5 sm:mt-4 sm:text-sm sm:leading-6 lg:text-base lg:leading-7"
                        : "mt-3 text-sm leading-5 sm:mt-5 sm:text-base sm:leading-7 lg:text-xl lg:leading-9"
                  }`}
                >
                  {activeCard.subtitle}
                </p>
              </div>

              <div className={`${isCompact ? "mt-2.5" : "mt-4"} lg:hidden`}>
                <CompactMatchupCard
                  homeTeam={activeCard.homeTeam}
                  awayTeam={activeCard.awayTeam}
                  homeColor={activeCard.homeColor}
                  awayColor={activeCard.awayColor}
                />
              </div>
            </div>

            <div>
              <div
                className={`grid max-w-2xl grid-cols-4 ${
                  isUltraCompact
                    ? "gap-1.5 sm:gap-2"
                    : isCompact
                      ? "gap-2 sm:gap-2.5"
                      : "gap-2.5 sm:gap-3"
                }`}
              >
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className={`border border-[#24445a] bg-[#081822]/72 shadow-[0_16px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm ${
                      isUltraCompact
                        ? "rounded-[0.95rem] px-2 py-2"
                        : isCompact
                        ? "rounded-[1rem] px-2.5 py-2.5 sm:rounded-[1.2rem] sm:px-3 sm:py-3.5"
                        : "rounded-[1.1rem] px-3 py-3.5 sm:rounded-[1.4rem] sm:px-4 sm:py-5"
                    }`}
                  >
                    <div
                      className={`font-black leading-none tracking-[-0.04em] ${
                        isUltraCompact
                          ? "text-[0.95rem] sm:text-[1.2rem]"
                          : isCompact
                            ? "text-[1.15rem] sm:text-[1.55rem]"
                            : "text-[1.35rem] sm:text-[2rem]"
                      }`}
                      style={{ color: activeCard.accent }}
                    >
                      {metric.value}
                    </div>
                    <div
                      className={`font-bold uppercase tracking-[0.16em] text-white/35 ${
                        isUltraCompact
                          ? "mt-1 text-[0.48rem] leading-3"
                          : isCompact
                            ? "mt-1.5 text-[0.58rem] sm:text-[0.62rem]"
                            : "mt-2 text-[0.68rem]"
                      }`}
                    >
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-center ${
                  isUltraCompact
                    ? "mt-2.5 gap-2 sm:mt-3 sm:gap-3"
                    : isCompact
                      ? "mt-3 gap-2.5 sm:mt-4 sm:gap-3"
                      : "mt-4 gap-2.5 sm:mt-6 sm:gap-4"
                }`}
              >
                <div
                  className={`text-white/50 ${
                    isUltraCompact
                      ? "text-[10px] leading-4 sm:text-xs sm:leading-5"
                      : isCompact
                        ? "text-[11px] leading-4.5 sm:text-xs sm:leading-5"
                        : "text-xs leading-5 sm:text-sm sm:leading-6"
                  }`}
                >
                  {activeCard.contestCount > 0
                    ? `${activeCard.contestCount} contest${activeCard.contestCount === 1 ? "" : "s"} live for this fixture`
                    : "Latest IPL fixture from the provider schedule"}
                  <span className="hidden sm:inline mx-2 text-white/25">|</span>
                  <span className="block sm:inline">{activeCard.venue}</span>
                </div>
              </div>

              {isMobile ? (
                <>
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={onOpenContests}
                      className={`inline-flex items-center justify-center gap-2 font-black uppercase tracking-tight transition-transform hover:-translate-y-0.5 ${
                        isUltraCompact
                          ? "min-w-[9rem] rounded-[1rem] px-4 py-2 text-[12px]"
                          : "min-w-[10.5rem] rounded-[1.1rem] px-5 py-2.5 text-[13px]"
                      }`}
                      style={{
                        backgroundColor: activeCard.accent,
                        color: readableTextColor(activeCard.accent),
                        boxShadow: `0 14px 36px ${activeCard.accent}40`,
                      }}
                    >
                      Join Now
                      <ArrowRight className={isUltraCompact ? "h-4 w-4" : "w-5 h-5"} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-2">
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
                </>
              ) : null}
            </div>
          </div>

          <div className="hidden items-center justify-center lg:flex lg:justify-end">
            <div className="w-full max-w-[420px] rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(53,81,97,0.72),rgba(30,45,56,0.82))] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:rounded-[2rem] sm:p-8">
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

        {!isMobile ? (
          <div
            className={`absolute inset-x-0 z-20 flex justify-center px-3 ${
              isUltraCompact
                ? "bottom-10"
                : isCompact
                  ? "bottom-11"
                  : "bottom-12 sm:bottom-14"
            }`}
          >
            <button
              type="button"
              onClick={onOpenContests}
              className={`inline-flex items-center justify-center gap-2 font-black uppercase tracking-tight transition-transform hover:-translate-y-0.5 ${
                isUltraCompact
                  ? "min-w-[9rem] rounded-[1rem] px-4 py-2 text-[12px]"
                  : isCompact
                    ? "min-w-[10rem] rounded-[1.1rem] px-4.5 py-2.5 text-[13px] sm:min-w-[11rem] sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                    : "min-w-[11rem] rounded-2xl px-5 py-3 text-sm sm:min-w-[12rem] sm:text-base lg:px-7 lg:py-4 lg:text-lg"
              }`}
              style={{
                backgroundColor: activeCard.accent,
                color: readableTextColor(activeCard.accent),
                boxShadow: `0 14px 36px ${activeCard.accent}40`,
              }}
            >
              Join Now
              <ArrowRight className={isUltraCompact ? "h-4 w-4" : "w-5 h-5"} />
            </button>
          </div>
        ) : null}

        {!isMobile ? (
          <div
            className={`absolute left-0 right-0 z-20 flex items-center justify-center gap-2 ${
              isUltraCompact ? "bottom-2.5" : isCompact ? "bottom-3" : "bottom-5"
            }`}
          >
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
        ) : null}
      </article>
    </section>
  );
}

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

function CompactMatchupCard({
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

function TeamTile({ align, primary, team }: TeamTileProps) {
  return (
    <div
      className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}
    >
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

function CompactTeamTile({ primary, team }: { primary: string; team: Team }) {
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

function readableTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#09202d" : "#ffffff";
}

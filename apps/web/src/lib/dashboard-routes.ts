export type DashboardRoute = "home" | "contests" | "leagues" | "predictions" | "locker";

const DASHBOARD_ROUTE_PATHS: Record<DashboardRoute, string> = {
  home: "/",
  contests: "/contests",
  leagues: "/leagues",
  predictions: "/predictions",
  locker: "/locker"
};

export function dashboardPathForRoute(route: DashboardRoute): string {
  return DASHBOARD_ROUTE_PATHS[route];
}

export function dashboardRouteFromPath(pathname: string): DashboardRoute {
  const normalized = normalizePathname(pathname);

  if (normalized === "/") {
    return "home";
  }

  if (normalized === "/contests") {
    return "contests";
  }

  if (normalized === "/leagues" || normalized.startsWith("/leagues/")) {
    return "leagues";
  }

  if (normalized === "/predictions") {
    return "predictions";
  }

  if (normalized === "/locker") {
    return "locker";
  }

  return "home";
}

export function leagueIdFromPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname);
  if (!normalized.startsWith("/leagues/")) {
    return null;
  }

  const segments = normalized.split("/").filter(Boolean);
  return segments[1] || null;
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

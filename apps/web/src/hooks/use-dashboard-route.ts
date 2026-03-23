import { useCallback, useEffect, useState } from "react";

import {
  dashboardPathForRoute,
  dashboardRouteFromPath,
  leagueIdFromPath,
  type DashboardRoute
} from "../lib/dashboard-routes";

function readCurrentRoute(): DashboardRoute {
  return dashboardRouteFromPath(window.location.pathname);
}

export function useDashboardRoute() {
  const [route, setRoute] = useState<DashboardRoute>(() => readCurrentRoute());
  const [leagueId, setLeagueId] = useState<string | null>(() => leagueIdFromPath(window.location.pathname));

  useEffect(() => {
    const currentRoute = readCurrentRoute();
    const canonicalPath = dashboardPathForRoute(currentRoute);

    if (currentRoute !== "leagues" && window.location.pathname !== canonicalPath) {
      window.history.replaceState(window.history.state, "", canonicalPath);
    }

    setRoute(currentRoute);
    setLeagueId(leagueIdFromPath(window.location.pathname));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readCurrentRoute());
      setLeagueId(leagueIdFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((nextRoute: DashboardRoute) => {
    const nextPath = dashboardPathForRoute(nextRoute);

    if (window.location.pathname !== nextPath) {
      window.history.pushState(window.history.state, "", nextPath);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setRoute(nextRoute);
    setLeagueId(null);
  }, []);

  const navigateToLeague = useCallback((nextLeagueId: string) => {
    const nextPath = `/leagues/${nextLeagueId}`;

    if (window.location.pathname !== nextPath) {
      window.history.pushState(window.history.state, "", nextPath);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setRoute("leagues");
    setLeagueId(nextLeagueId);
  }, []);

  return {
    route,
    leagueId,
    navigate,
    navigateToLeague
  };
}

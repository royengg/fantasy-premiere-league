import { prisma } from "../lib/prisma.js";
import { PrismaAppRepository } from "../repositories/prisma-app-repository.js";
import { cricketDataService } from "../services/cricket-data-service.js";
import {
  buildProviderSyncSnapshot,
  providerSyncResult
} from "../services/provider-sync-service.js";

const DEFAULT_SEASON = 2026;
const MINIMUM_SAFE_REQUESTS = 7;
const MAX_TOTAL_REQUESTS = 12;
const MAX_SQUAD_REQUESTS = 8;

async function main() {
  const repository = new PrismaAppRepository();
  cricketDataService.configureBudgetStore(repository);

  const season = Number(process.env.PROVIDER_SYNC_SEASON ?? DEFAULT_SEASON);
  const context = await repository.getProviderSyncContext();

  if (context.remainingDailyRequestBudget < MINIMUM_SAFE_REQUESTS) {
    throw new Error(
      `Not enough provider budget left for a full roster sync. Remaining: ${context.remainingDailyRequestBudget}.`
    );
  }

  await repository.updateProviderState({
    status: "syncing",
    lastAttemptedAt: new Date().toISOString()
  });

  try {
    const snapshot = await buildProviderSyncSnapshot(cricketDataService, season, {
      maxProviderRequests: Math.min(context.remainingDailyRequestBudget, MAX_TOTAL_REQUESTS),
      maxSquadRequests: MAX_SQUAD_REQUESTS,
      squadFetchMode: "cover-all-upcoming-teams"
    });

    if (snapshot.matches.length === 0) {
      throw new Error("Provider sync returned no IPL matches.");
    }

    if (snapshot.players.length === 0) {
      throw new Error("Provider sync returned no squad players.");
    }

    await repository.applyProviderSnapshot(snapshot);

    const [provider, teams] = await Promise.all([
      repository.getProviderStatus(),
      repository.getTeamsWithPlayers()
    ]);

    console.log(
      JSON.stringify(
        {
          season,
          imported: providerSyncResult(snapshot),
          provider,
          teamPlayerCounts: teams
            .filter((team) => team.id.startsWith("provider:"))
            .map((team) => ({
              shortName: team.shortName,
              players: team.players.length
            })),
          upcomingMatches: snapshot.matches.slice(0, 10).map((match) => ({
            id: match.id,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            startsAt: match.startsAt,
            state: match.state
          }))
        },
        null,
        2
      )
    );
  } catch (error) {
    await repository.updateProviderState({
      status: context.provider.status,
      lastAttemptedAt: new Date().toISOString()
    });
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

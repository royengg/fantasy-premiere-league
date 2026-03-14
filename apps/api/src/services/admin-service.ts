import type { AdminCorrectionInput } from "@fantasy-cricket/validators";

import type { JobManager } from "../lib/jobs.js";
import type { GameService } from "./game-service.js";

export class AdminService {
  constructor(
    private readonly gameService: GameService,
    private readonly jobs: JobManager
  ) {}

  async syncProvider() {
    await this.jobs.enqueueProviderSync();
    return this.gameService.syncProvider();
  }

  async applyCorrection(matchId: string, input: AdminCorrectionInput) {
    const result = this.gameService.applyCorrection(matchId, input.playerId, input.label, input.points);
    await this.jobs.enqueueLeaderboardRefresh(matchId);
    return result;
  }
}


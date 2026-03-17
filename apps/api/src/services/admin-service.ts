import type { AdminCorrectionInput, SettlePredictionInput } from "@fantasy-cricket/validators";

import type { GameService } from "./game-service.js";

export class AdminService {
  constructor(private readonly gameService: GameService) {}

  async syncProvider() {
    return this.gameService.syncProvider();
  }

  async applyCorrection(matchId: string, input: AdminCorrectionInput) {
    return this.gameService.applyCorrection(matchId, input.playerId, input.label, input.points);
  }

  async settlePrediction(questionId: string, input: SettlePredictionInput) {
    return this.gameService.settlePrediction(questionId, input.correctOptionId);
  }
}

import type {
  AuctionCatalogPlayer,
  AuctionRoomDetails,
  AuctionRoomSummary
} from "@fantasy-cricket/types";
import type {
  CreateAuctionRoomInput,
  JoinAuctionRoomInput,
  UpdateAuctionRoomSettingsInput
} from "@fantasy-cricket/validators";

import type { AuctionRuntimeRepository } from "../repositories/auction-runtime-repository.js";

export class AuctionService {
  constructor(private readonly repository: AuctionRuntimeRepository) {}

  async listRooms(userId: string): Promise<AuctionRoomSummary[]> {
    return this.repository.listAuctionRoomsForUser(userId);
  }

  async getCatalog(): Promise<AuctionCatalogPlayer[]> {
    return this.repository.getAuctionCatalogPlayers();
  }

  async getRoom(userId: string, roomId: string): Promise<AuctionRoomDetails> {
    return this.repository.getAuctionRoomDetails(userId, roomId);
  }

  async createRoom(userId: string, input: CreateAuctionRoomInput): Promise<AuctionRoomDetails> {
    return this.repository.createAuctionRoomRecord(userId, input);
  }

  async updateRoomSettings(
    userId: string,
    roomId: string,
    input: UpdateAuctionRoomSettingsInput
  ): Promise<AuctionRoomDetails> {
    return this.repository.updateAuctionRoomSettingsRecord(userId, roomId, input);
  }

  async joinRoom(userId: string, input: JoinAuctionRoomInput): Promise<AuctionRoomDetails> {
    return this.repository.joinAuctionRoomRecord(userId, input);
  }

  async setReady(userId: string, roomId: string, ready: boolean): Promise<AuctionRoomDetails> {
    return this.repository.setAuctionReadyRecord(userId, roomId, ready);
  }

  async startRoom(userId: string, roomId: string, now = new Date().toISOString()): Promise<AuctionRoomDetails> {
    return this.repository.startAuctionRoomRecord(userId, roomId, now);
  }

  async placeBid(
    userId: string,
    roomId: string,
    amountLakhs: number,
    now = new Date().toISOString()
  ): Promise<AuctionRoomDetails> {
    return this.repository.placeAuctionBidRecord(userId, roomId, amountLakhs, now);
  }

  async withdrawFromLot(
    userId: string,
    roomId: string,
    now = new Date().toISOString()
  ): Promise<AuctionRoomDetails> {
    return this.repository.withdrawFromAuctionLotRecord(userId, roomId, now);
  }

  async voteSkip(
    userId: string,
    roomId: string,
    now = new Date().toISOString()
  ): Promise<AuctionRoomDetails> {
    return this.repository.voteSkipAuctionLotRecord(userId, roomId, now);
  }

  async advanceDueRooms(now = new Date().toISOString()): Promise<string[]> {
    return this.repository.advanceDueAuctionRooms(now);
  }

  async participantIds(roomId: string): Promise<string[]> {
    return this.repository.getAuctionParticipantIds(roomId);
  }
}

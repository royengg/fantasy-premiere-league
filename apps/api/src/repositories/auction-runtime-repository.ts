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

export interface AuctionRuntimeRepository {
  listAuctionRoomsForUser(userId: string): Promise<AuctionRoomSummary[]>;
  getAuctionCatalogPlayers(): Promise<AuctionCatalogPlayer[]>;
  getAuctionRoomDetails(userId: string, roomId: string): Promise<AuctionRoomDetails>;
  createAuctionRoomRecord(userId: string, input: CreateAuctionRoomInput): Promise<AuctionRoomDetails>;
  updateAuctionRoomSettingsRecord(
    userId: string,
    roomId: string,
    input: UpdateAuctionRoomSettingsInput
  ): Promise<AuctionRoomDetails>;
  joinAuctionRoomRecord(userId: string, input: JoinAuctionRoomInput): Promise<AuctionRoomDetails>;
  setAuctionReadyRecord(userId: string, roomId: string, ready: boolean): Promise<AuctionRoomDetails>;
  startAuctionRoomRecord(userId: string, roomId: string, now: string): Promise<AuctionRoomDetails>;
  placeAuctionBidRecord(
    userId: string,
    roomId: string,
    poolEntryId: string,
    amountLakhs: number,
    now: string
  ): Promise<AuctionRoomDetails>;
  withdrawFromAuctionLotRecord(
    userId: string,
    roomId: string,
    poolEntryId: string,
    now: string
  ): Promise<AuctionRoomDetails>;
  voteSkipAuctionLotRecord(
    userId: string,
    roomId: string,
    poolEntryId: string,
    now: string
  ): Promise<AuctionRoomDetails>;
  advanceDueAuctionRooms(now: string): Promise<string[]>;
  getAuctionParticipantIds(roomId: string): Promise<string[]>;
}

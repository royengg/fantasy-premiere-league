import { describe, expect, it } from "vitest";

import {
  canAffordAuctionBid,
  minimumDomesticPlayersNeeded,
  nextAuctionBidAmount
} from "@fantasy-cricket/domain";

describe("auction helpers", () => {
  it("advances bids using the configured ladder", () => {
    expect(nextAuctionBidAmount(25)).toBe(25);
    expect(nextAuctionBidAmount(25, 25)).toBe(50);
    expect(nextAuctionBidAmount(25, 100)).toBe(150);
    expect(nextAuctionBidAmount(25, 500)).toBe(600);
  });

  it("prevents bids that would strand remaining squad slots", () => {
    expect(canAffordAuctionBid(1000, 3, 600, 25)).toBe(true);
    expect(canAffordAuctionBid(1000, 3, 980, 25)).toBe(false);
  });

  it("calculates the domestic-player floor for season leagues", () => {
    expect(minimumDomesticPlayersNeeded(15, 13, 6)).toBe(105);
  });
});

export function nextAuctionBidAmount(basePriceLakhs: number, currentBidLakhs?: number) {
  if (!currentBidLakhs) {
    return basePriceLakhs;
  }

  if (currentBidLakhs < 100) {
    return currentBidLakhs + 25;
  }

  if (currentBidLakhs < 500) {
    return currentBidLakhs + 50;
  }

  return currentBidLakhs + 100;
}

export function canAffordAuctionBid(
  purseRemainingLakhs: number,
  slotsRemaining: number,
  amountLakhs: number,
  basePriceLakhs: number
) {
  const remainingSlotsAfterWin = slotsRemaining - 1;
  return amountLakhs <= purseRemainingLakhs - remainingSlotsAfterWin * basePriceLakhs;
}

export function minimumDomesticPlayersNeeded(
  participantCount: number,
  squadSize: number,
  maxOverseas: number
) {
  return participantCount * Math.max(squadSize - maxOverseas, 0);
}

import { describe, expect, it } from "vitest";

import { equipCosmetic, unlockCosmetic } from "@fantasy-cricket/domain";
import type { CosmeticItem, Profile, UserInventory } from "@fantasy-cricket/types";

const item: CosmeticItem = {
  id: "cos-1",
  name: "Sunset Frame",
  description: "Profile frame",
  category: "avatar-frame",
  rarity: "rare",
  themeToken: "#ff8844",
  gameplayAffecting: false,
  transferable: false,
  redeemable: false,
  resaleValue: false
};

describe("inventory rules", () => {
  it("unlocks a cosmetic only once", () => {
    const inventory: UserInventory = {
      userId: "user-1",
      cosmeticIds: [],
      badgeIds: [],
      equipped: {}
    };

    const firstUnlock = unlockCosmetic(inventory, "user-1", item, "prediction", new Date().toISOString());
    expect(firstUnlock.inventory.cosmeticIds).toContain("cos-1");
    expect(firstUnlock.unlock?.cosmeticId).toBe("cos-1");

    const secondUnlock = unlockCosmetic(firstUnlock.inventory, "user-1", item, "prediction", new Date().toISOString());
    expect(secondUnlock.unlock).toBeUndefined();
    expect(secondUnlock.inventory.cosmeticIds).toHaveLength(1);
  });

  it("equips only unlocked cosmetics", () => {
    const inventory: UserInventory = {
      userId: "user-1",
      cosmeticIds: ["cos-1"],
      badgeIds: [],
      equipped: {}
    };
    const profile: Profile = {
      userId: "user-1",
      username: "player",
      xp: 10,
      level: 1,
      streak: 0,
      onboardingCompleted: true,
      equippedCosmetics: {}
    };

    const equipped = equipCosmetic(inventory, profile, item);
    expect(equipped.inventory.equipped["avatar-frame"]).toBe("cos-1");
    expect(equipped.profile.equippedCosmetics["avatar-frame"]).toBe("cos-1");
  });

  it("rejects equipping cosmetics that are not in the inventory", () => {
    const inventory: UserInventory = {
      userId: "user-1",
      cosmeticIds: [],
      badgeIds: [],
      equipped: {}
    };
    const profile: Profile = {
      userId: "user-1",
      username: "player",
      xp: 10,
      level: 1,
      streak: 0,
      onboardingCompleted: true,
      equippedCosmetics: {}
    };

    expect(() => equipCosmetic(inventory, profile, item)).toThrow("Cosmetic is not unlocked.");
  });
});

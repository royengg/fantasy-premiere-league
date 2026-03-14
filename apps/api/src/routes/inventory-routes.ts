import { Router, type Router as ExpressRouter } from "express";

import { equipCosmeticSchema } from "@fantasy-cricket/validators";

import { currentUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createInventoryRouter({ gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", (req, res) => {
    try {
      const inventory = gameService.getInventory(currentUserId(req));
      res.json({
        cosmetics: inventory.cosmetics,
        equipped: inventory.inventory.equipped
      });
    } catch (error) {
      sendError(res, 404, error, "Inventory not found.");
    }
  });

  router.post("/equip", (req, res) => {
    const parsed = equipCosmeticSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid cosmetic." });
      return;
    }

    try {
      res.json(gameService.equipUserCosmetic(currentUserId(req), parsed.data.cosmeticId));
    } catch (error) {
      sendError(res, 400, error, "Equip failed.");
    }
  });

  return router;
}

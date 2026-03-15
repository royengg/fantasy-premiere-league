import { Router, type Router as ExpressRouter } from "express";

import { equipCosmeticSchema } from "@fantasy-cricket/validators";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createInventoryRouter({ authService, gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Inventory not found.");
      return;
    }

    try {
      const inventory = await gameService.getInventory(userId);
      res.json({
        cosmetics: inventory.cosmetics,
        equipped: inventory.inventory.equipped
      });
    } catch (error) {
      sendError(res, 404, error, "Inventory not found.");
    }
  });

  router.post("/equip", async (req, res) => {
    const parsed = equipCosmeticSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid cosmetic." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Equip failed.");
      return;
    }

    try {
      res.json(await gameService.equipUserCosmetic(userId, parsed.data.cosmeticId));
    } catch (error) {
      sendError(res, 400, error, "Equip failed.");
    }
  });

  return router;
}

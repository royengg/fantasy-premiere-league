import { Router, type Router as ExpressRouter } from "express";

import {
  authLoginSchema,
  authOnboardingSchema,
  authRegisterSchema
} from "@fantasy-cricket/validators";

import {
  authenticatedUserId,
  bearerToken,
  sendError,
  type ApiDependencies
} from "../lib/http.js";

export function createAuthRouter({ authService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.post("/register", async (req, res) => {
    const parsed = authRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid registration payload." });
      return;
    }

    try {
      const session = await authService.register(parsed.data);
      res.status(201).json(session);
    } catch (error) {
      sendError(res, 400, error, "Registration failed.");
    }
  });

  router.post("/login", async (req, res) => {
    const parsed = authLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid login payload." });
      return;
    }

    try {
      const session = await authService.login(parsed.data);
      res.json(session);
    } catch (error) {
      sendError(res, 401, error, "Login failed.");
    }
  });

  router.post("/logout", async (req, res) => {
    try {
      await authService.revoke(bearerToken(req));
      res.status(204).send();
    } catch (error) {
      sendError(res, 400, error, "Logout failed.");
    }
  });

  router.patch("/onboarding", async (req, res) => {
    const parsed = authOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid onboarding payload." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Onboarding failed.");
      return;
    }

    try {
      const profile = await authService.completeOnboarding(userId, parsed.data);
      res.json(profile);
    } catch (error) {
      sendError(res, 400, error, "Onboarding failed.");
    }
  });

  return router;
}

import { z } from "zod";

export const authBootstrapSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(64)
});

export const createLeagueSchema = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().trim().max(200).optional(),
  visibility: z.enum(["public", "private"])
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32)
});

export const submitRosterSchema = z
  .object({
    playerIds: z.array(z.string()).length(11),
    captainPlayerId: z.string(),
    viceCaptainPlayerId: z.string()
  })
  .superRefine((value, ctx) => {
    if (new Set(value.playerIds).size !== value.playerIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Players can only be selected once.",
        path: ["playerIds"]
      });
    }

    if (!value.playerIds.includes(value.captainPlayerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Captain must be in the roster.",
        path: ["captainPlayerId"]
      });
    }

    if (!value.playerIds.includes(value.viceCaptainPlayerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vice captain must be in the roster.",
        path: ["viceCaptainPlayerId"]
      });
    }

    if (value.captainPlayerId === value.viceCaptainPlayerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Captain and vice captain must be different players.",
        path: ["viceCaptainPlayerId"]
      });
    }
  });

export const predictionAnswerSchema = z.object({
  optionId: z.string().min(1)
});

export const equipCosmeticSchema = z.object({
  cosmeticId: z.string().min(1)
});

export const adminCorrectionSchema = z.object({
  playerId: z.string().min(1),
  points: z.number().int().min(-50).max(50),
  label: z.string().trim().min(3).max(100)
});

export const settlePredictionSchema = z.object({
  correctOptionId: z.string().min(1)
});

export type AuthBootstrapInput = z.infer<typeof authBootstrapSchema>;
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;
export type SubmitRosterInput = z.infer<typeof submitRosterSchema>;
export type PredictionAnswerInput = z.infer<typeof predictionAnswerSchema>;
export type EquipCosmeticInput = z.infer<typeof equipCosmeticSchema>;
export type AdminCorrectionInput = z.infer<typeof adminCorrectionSchema>;
export type SettlePredictionInput = z.infer<typeof settlePredictionSchema>;

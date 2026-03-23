import { z } from "zod";

const usernamePattern = /^[a-zA-Z0-9_]+$/;

export const authRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(64),
  password: z.string().min(8).max(72)
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

export const authOnboardingSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(usernamePattern, {
    message: "Username can only use letters, numbers, and underscores."
  }),
  favoriteTeamId: z.string().min(1)
});

// Defense-in-depth: strip HTML angle brackets from user-controlled names (#19)
function stripHtmlBrackets(value: string) {
  return value.replace(/[<>]/g, "");
}

export const createLeagueSchema = z.object({
  name: z.string().trim().min(3).max(60).transform(stripHtmlBrackets),
  description: z.string().trim().max(200).optional(),
  visibility: z.enum(["public", "private"]),
  maxMembers: z.number().int().min(2).max(15)
});

const auctionCustomPoolPlayerIdsSchema = z.array(z.string().min(1)).max(500).optional();

const auctionRoomSchemaFields = {
  leagueId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(3).max(60).transform(stripHtmlBrackets),
  visibility: z.enum(["public", "private"]),
  maxParticipants: z.number().int().min(2).max(15),
  squadSize: z.number().int().min(2).max(20),
  bidWindowSeconds: z.number().int().min(8).max(60),
  bidExtensionSeconds: z.number().int().min(2).max(15).default(5),
  playerPoolMode: z.enum(["all", "custom"]),
  playerPoolPlayerIds: auctionCustomPoolPlayerIdsSchema
} satisfies z.ZodRawShape;

const baseAuctionRoomSchema = z.object(auctionRoomSchemaFields);

export const createAuctionRoomSchema = baseAuctionRoomSchema
  .superRefine((value, ctx) => {
    if (value.playerPoolMode === "custom") {
      const uniqueCount = new Set(value.playerPoolPlayerIds ?? []).size;
      if (!value.playerPoolPlayerIds?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select at least one player for a custom auction pool.",
          path: ["playerPoolPlayerIds"]
        });
      } else if (uniqueCount !== value.playerPoolPlayerIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom player pool cannot include duplicate players.",
          path: ["playerPoolPlayerIds"]
        });
      }
    }
  });

export const updateAuctionRoomSettingsSchema = z.object(auctionRoomSchemaFields).omit({
  visibility: true,
  leagueId: true
}).superRefine((value, ctx) => {
  if (value.playerPoolMode === "custom") {
    const uniqueCount = new Set(value.playerPoolPlayerIds ?? []).size;
    if (!value.playerPoolPlayerIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one player for a custom auction pool.",
        path: ["playerPoolPlayerIds"]
      });
    } else if (uniqueCount !== value.playerPoolPlayerIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom player pool cannot include duplicate players.",
        path: ["playerPoolPlayerIds"]
      });
    }
  }
});

export const joinAuctionRoomSchema = z
  .object({
    roomId: z.string().min(1).optional(),
    inviteCode: z.string().trim().min(4).max(32).optional()
  })
  .superRefine((value, ctx) => {
    if (!value.roomId && !value.inviteCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Room ID or invite code is required.",
        path: ["roomId"]
      });
    }
  });

export const auctionReadySchema = z.object({
  ready: z.boolean()
});

export const auctionBidSchema = z.object({
  poolEntryId: z.string().min(1),
  amountLakhs: z.number().int().min(25).max(10_000)
});

export const auctionLotActionSchema = z.object({
  poolEntryId: z.string().min(1)
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32)
});

export const submitRosterSchema = z
  .object({
    starterPlayerIds: z.array(z.string()).length(11),
    substitutePlayerIds: z.array(z.string()).length(2),
    captainPlayerId: z.string(),
    viceCaptainPlayerId: z.string()
  })
  .superRefine((value, ctx) => {
    const combined = [...value.starterPlayerIds, ...value.substitutePlayerIds];

    if (new Set(combined).size !== combined.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Players can only be selected once.",
        path: ["starterPlayerIds"]
      });
    }

    if (!value.starterPlayerIds.includes(value.captainPlayerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Captain must be in the starting XI.",
        path: ["captainPlayerId"]
      });
    }

    if (!value.starterPlayerIds.includes(value.viceCaptainPlayerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vice captain must be in the starting XI.",
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

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthOnboardingInput = z.infer<typeof authOnboardingSchema>;
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type CreateAuctionRoomInput = z.infer<typeof createAuctionRoomSchema>;
export type UpdateAuctionRoomSettingsInput = z.infer<typeof updateAuctionRoomSettingsSchema>;
export type JoinAuctionRoomInput = z.infer<typeof joinAuctionRoomSchema>;
export type AuctionReadyInput = z.infer<typeof auctionReadySchema>;
export type AuctionBidInput = z.infer<typeof auctionBidSchema>;
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;
export type SubmitRosterInput = z.infer<typeof submitRosterSchema>;
export type PredictionAnswerInput = z.infer<typeof predictionAnswerSchema>;
export type EquipCosmeticInput = z.infer<typeof equipCosmeticSchema>;
export type AdminCorrectionInput = z.infer<typeof adminCorrectionSchema>;
export type SettlePredictionInput = z.infer<typeof settlePredictionSchema>;

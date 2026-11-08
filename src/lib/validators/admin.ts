import { z } from "zod";
import { USER_ROLES } from "@/types/domain";

/**
 * Shared Zod Schemas for Phase 6 Admin Governance & CMS.
 * NOTE: Avoid `.transform()` so input/output types stay identical for `zodResolver`.
 */

export const garageDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(400).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.decision === "rejected" && (!val.reason || val.reason.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Rejection reason is required (min 3 characters).",
      });
    }
  });

export type GarageDecisionInput = z.infer<typeof garageDecisionSchema>;

export const adminUserUpdateSchema = z.object({
  suspended: z.boolean().optional(),
  role: z.enum(USER_ROLES).optional(),
  garagePlan: z.enum(["free", "pro"]).optional(),
});

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

export const platformFaqItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  questionBg: z.string().trim().min(3).max(260),
  answerBg: z.string().trim().min(3).max(1600),
  questionEn: z.string().trim().min(3).max(260),
  answerEn: z.string().trim().min(3).max(1600),
  order: z.number().int().min(0).max(100),
});

export const platformContentSchema = z
  .object({
    banner: z.object({
      enabled: z.boolean(),
      variant: z.enum(["info", "warning", "success"]),
      messageBg: z.string().trim().max(280),
      messageEn: z.string().trim().max(280),
      linkUrl: z.string().trim().max(260).nullable(),
      linkLabelBg: z.string().trim().max(80).nullable(),
      linkLabelEn: z.string().trim().max(80).nullable(),
    }),
    faqs: z.array(platformFaqItemSchema).max(30),
  })
  .superRefine((val, ctx) => {
    if (val.banner.enabled) {
      if (val.banner.messageBg.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["banner", "messageBg"],
          message: "Bulgarian banner text is required when enabled.",
        });
      }
      if (val.banner.messageEn.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["banner", "messageEn"],
          message: "English banner text is required when enabled.",
        });
      }
    }
  });

export type PlatformContentInput = z.infer<typeof platformContentSchema>;


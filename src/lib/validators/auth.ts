import { z } from "zod";
import { APP_LOCALES, REGISTRABLE_ROLES } from "@/types/domain";

/**
 * Shared Authentication & Session Zod Schemas (Client + Server)
 *
 * Security Invariant:
 * `ADMIN` is strictly excluded from `registrableRoleSchema` so a user can NEVER
 * self-select or submit ADMIN at registration time.
 */

export const registrableRoleSchema = z.enum(REGISTRABLE_ROLES);

export const loginSchema = z.object({
  email: z.string().trim().min(1, "emailRequired").email("emailInvalid"),
  password: z.string().min(8, "passwordMinLength").max(128, "passwordMaxLength"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "nameMinLength")
      .max(80, "nameMaxLength"),
    email: z.string().trim().min(1, "emailRequired").email("emailInvalid"),
    password: z
      .string()
      .min(8, "passwordMinLength")
      .max(128, "passwordMaxLength")
      .regex(/[A-Za-z]/, "passwordNeedsLetter")
      .regex(/[0-9]/, "passwordNeedsNumber"),
    confirmPassword: z.string().min(1, "confirmPasswordRequired"),
    role: registrableRoleSchema,
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "termsRequired",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordsMustMatch",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "emailRequired").email("emailInvalid"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Payload sent to `POST /api/auth/session` after client Firebase sign-in or sign-up.
 * Notice `requestedRole` only accepts `"USER"` or `"GARAGE_OWNER"` and is honored
 * ONLY when bootstrapping a brand-new user profile for the first time.
 */
export const createSessionRequestSchema = z.object({
  idToken: z.string().min(20),
  requestedRole: registrableRoleSchema.optional(),
  displayName: z.string().trim().min(2).max(80).optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;


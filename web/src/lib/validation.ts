import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const timelineInputSchema = z.object({
  username: z.string().trim().max(30).optional().or(z.literal("")),
  applicationMethod: z.enum(["ONLINE", "POST"]),
  applicationDate: z.string().date(),
  biometricDate: z.string().date(),
  approvalDate: z.string().date().optional().or(z.literal("")),
  receivedHomeOfficeEmail: z.coerce.boolean(),
  ceremonyDate: z.string().date().optional().or(z.literal("")),
  status: z.enum([
    "SUBMITTED",
    "BIOMETRICS_DONE",
    "EMAIL_RECEIVED",
    "APPROVED",
    "CEREMONY_PENDING",
    "CEREMONY_DONE",
  ]),
});

export const adminTimelineInputSchema = timelineInputSchema.extend({
  sourceType: z.enum(["WEBSITE", "REDDIT"]),
  isVerified: z.coerce.boolean(),
});

export const redditConfigSchema = z.object({
  postUrl: z.string().url().includes("reddit.com"),
  syncIntervalMins: z.coerce.number().int().min(15).max(10080),
  active: z.coerce.boolean().default(true),
});

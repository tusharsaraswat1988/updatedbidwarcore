import { z } from "zod";

/** Cloudinary HTTPS URLs and offline `/media` / `/static` paths from local import. */
export const localMediaUrlSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => !v || v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"),
    "URL must be https, http, or a local path",
  );

export function zodFirstError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  return issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
}

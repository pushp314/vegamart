import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120).optional(),
  email: z.string().email("A valid email is required.").max(255).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Message is required.").max(5000),
});

export type ContactBody = z.infer<typeof contactSchema>;

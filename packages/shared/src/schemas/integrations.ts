import { z } from 'zod';

export const connectBufferSchema = z.object({
  apiKey: z.string().trim().min(10).max(512),
});
export type ConnectBufferInput = z.infer<typeof connectBufferSchema>;

export const selectBufferOrganizationSchema = z.object({
  organizationId: z.string().trim().min(1).max(64),
});
export type SelectBufferOrganizationInput = z.infer<typeof selectBufferOrganizationSchema>;

export const sendInboxMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});
export type SendInboxMessageInput = z.infer<typeof sendInboxMessageSchema>;

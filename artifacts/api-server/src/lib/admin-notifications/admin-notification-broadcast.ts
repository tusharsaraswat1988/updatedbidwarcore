import type { Response } from "express";
import { logger } from "../logger.js";
import type { AdminNotificationCreatedPayload } from "./types.js";

export type AdminNotificationSseMessage =
  | { type: "ADMIN_NOTIFICATION_SYNC"; unreadCount: number }
  | ({ type: "ADMIN_NOTIFICATION_CREATED" } & AdminNotificationCreatedPayload);

interface AdminSseClient {
  write: (frame: string) => boolean;
}

const clients: Set<AdminSseClient> = new Set();

export function addAdminNotificationSseClient(res: Response): AdminSseClient {
  const client: AdminSseClient = {
    write: (frame) => res.write(frame),
  };
  clients.add(client);
  return client;
}

export function removeAdminNotificationSseClient(client: AdminSseClient): void {
  clients.delete(client);
}

export function getAdminNotificationSseClientCount(): number {
  return clients.size;
}

function formatSseData(payload: AdminNotificationSseMessage): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function broadcastAdminNotificationEvent(payload: AdminNotificationSseMessage): void {
  const frame = formatSseData(payload);
  for (const client of clients) {
    try {
      client.write(frame);
    } catch {
      clients.delete(client);
    }
  }
  logger.debug(
    { eventType: payload.type, clients: clients.size },
    "Admin notification SSE broadcast",
  );
}

import { SvelteComponent } from "svelte";
import { Writable } from "svelte/store";

export type NotificationType = "info" | "warn" | "error";

export type Notification = {
  id: string;
  type: NotificationType;
  message: string;
};

export const notifications: {
  subscribe: Writable<Notification[]>["subscribe"];
};

export function notify(message: string, type?: NotificationType): string;
export function dismiss(id: string): void;

export default class NotificationComponent extends SvelteComponent {}

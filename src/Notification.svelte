<script context="module" lang="ts">
import { writable } from "svelte/store";

export type NotificationType = "info" | "warn" | "error";

export type Notification = {
  id: string;
  type: NotificationType;
  message: string;
};

const _notifications = writable<Notification[]>([]);

/**
 * Global store of active notifications.
 * Subscribe to this to react to notification changes.
 */
export const notifications = {
  subscribe: _notifications.subscribe,
};

/**
 * Adds a new notification to the store.
 *
 * @param message The message to display
 * @param type The type of notification (info, warn, error)
 * @returns The generated ID of the notification
 */
export function notify(
  message: string,
  type: NotificationType = "info",
): string {
  const id = Math.random().toString(36).substring(2, 9);
  const notification: Notification = {
    id,
    type,
    message,
  };

  _notifications.update((list) => [...list, notification]);
  return id;
}

/**
 * Removes a notification from the store by ID.
 *
 * @param id The ID of the notification to remove
 */
export function dismiss(id: string): void {
  _notifications.update((list) => list.filter((n) => n.id !== id));
}
</script>

<script lang="ts">
import { fly } from "svelte/transition";
import { quintOut } from "svelte/easing";
</script>

<div class="notification-container" aria-live="polite">
  {#each $notifications as notification (notification.id)}
    <div
      class="notification-item {notification.type}"
      transition:fly={{ y: -20, duration: 400, easing: quintOut }}
      role="alert">
      <div class="accent-bar"></div>

      <div class="content">
        <div class="type-badge">{notification.type.toUpperCase()}</div>
        <p class="message">{notification.message}</p>
      </div>

      <button
        class="dismiss-btn"
        on:click={() => dismiss(notification.id)}
        aria-label="Dismiss notification"
        title="Dismiss notification">
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
.notification-container {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 90%;
  max-width: 500px;
  pointer-events: none;
}

.notification-item {
  background: #212121;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  min-height: 60px;
  position: relative;
  overflow: hidden;
  pointer-events: auto;
  border-radius: 4px;
}

.accent-bar {
  width: 2px;
  flex-shrink: 0;
}

/* Color Types Linked to Design/Cata Palette */
.notification-item.info .accent-bar {
  background: var(--cata-color-light_cyan);
}
.notification-item.warn .accent-bar {
  background: var(--cata-color-yellow);
}
.notification-item.error .accent-bar {
  background: var(--cata-color-red);
}

.content {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.type-badge {
  font-size: 0.65rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  color: var(--cata-color-gray);
  line-height: 1;
}

.notification-item.info .type-badge {
  color: var(--cata-color-cyan);
}
.notification-item.warn .type-badge {
  color: var(--cata-color-yellow);
}
.notification-item.error .type-badge {
  color: var(--cata-color-light_red);
}

.message {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--cata-color-white);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.dismiss-btn {
  background: none;
  border: none;
  color: var(--cata-color-gray);
  cursor: pointer;
  padding: 0 16px;
  font-size: 1.1rem;
  line-height: 1;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dismiss-btn:hover {
  color: var(--cata-color-white);
}

@media (max-width: 600px) {
  .notification-container {
    top: 5rem;
    width: 95%;
  }
}
</style>

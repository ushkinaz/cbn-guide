import type { Item, UseFunction } from "../types";

export function normalizeUseAction(action: Item["use_action"]): UseFunction[] {
  if (typeof action === "string")
    return [{ type: "__item_action__", id: action }];
  else if (Array.isArray(action)) {
    return action.map((s) => {
      if (typeof s === "string") return { type: "__item_action__", id: s };
      else if (Array.isArray(s)) {
        return { type: "__item_action__", id: s[0] };
      } else {
        return s;
      }
    });
  } else {
    return action ? [action] : [];
  }
}

import * as txNS from "@transifex/native";

/**
 * Handle ESM/CJS interop for @transifex/native.
 * In some environments (like Node with tsx), named exports might not be
 * correctly resolved from the CJS bundle of @transifex/native.
 */
const i18n: any = (txNS as any).default || txNS;

export const t = i18n.t;
export const tx = i18n.tx;

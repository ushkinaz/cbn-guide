import { isHTTPError, isNotFoundError } from "./http-errors";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  shouldRetry?: (error: unknown) => boolean;
  finalErrorMessage?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 2000;

function defaultShouldRetry(error: unknown): boolean {
  return !(isNotFoundError(error) || (isHTTPError(error) && error.isPermanent));
}

export async function retry<T>(
  promiseGenerator: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await promiseGenerator();
    } catch (e) {
      if (!shouldRetry(e)) {
        throw e;
      }

      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, e);

      if (attempt === maxAttempts) {
        if (options.finalErrorMessage) {
          throw new Error(options.finalErrorMessage);
        }
        throw e;
      }

      if (options.onRetry) {
        options.onRetry(attempt, e);
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error("Unexpected: retry loop exhausted");
}

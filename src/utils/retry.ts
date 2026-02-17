import { isHttpError } from "./http-errors";

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  shouldRetry?: (error: unknown) => boolean;
  finalErrorMessage?: string;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 2000;

function defaultShouldRetry(error: unknown): boolean {
  return !(isHttpError(error) && error.isPermanent);
}

export async function retry<T>(
  promiseGenerator: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  if (maxRetries <= 0) {
    return promiseGenerator();
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await promiseGenerator();
    } catch (e) {
      if (!shouldRetry(e)) {
        throw e;
      }

      console.error(`Attempt ${attempt}/${maxRetries} failed:`, e);

      if (attempt === maxRetries) {
        if (options.finalErrorMessage) {
          throw new Error(options.finalErrorMessage);
        }
        throw e;
      }

      if (options.onRetry) {
        options.onRetry(attempt, e);
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`Retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error("Unexpected: retry loop exhausted");
}

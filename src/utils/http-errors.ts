export class HTTPError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "HTTPError";
  }

  get isPermanent(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export function isHTTPError(error: unknown): error is HTTPError {
  return error instanceof HTTPError;
}

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof HTTPError) {
    return error.isNotFound;
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (/^(?:HTTP\s+)?404\b/i.test(message)) {
      return true;
    }
    if ("status" in error && (error as { status?: unknown }).status === 404) {
      return true;
    }
  }

  if (typeof error === "string") {
    const message = error.trim();
    if (/^(?:HTTP\s+)?404\b/i.test(message)) {
      return true;
    }
  }

  return false;
}

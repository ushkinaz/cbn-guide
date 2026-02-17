export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  get isPermanent(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof HttpError) {
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

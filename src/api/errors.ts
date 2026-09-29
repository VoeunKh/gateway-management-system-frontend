import type { components } from './types.gen';

type ErrorBody = components['schemas']['Error'];

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";

/** Every failed request rejects with this; `status` is 0 when the network failed. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error: unknown = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** Reads `{error:{code,message,details}}`; anything else becomes a generic message. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  if (isErrorBody(body)) {
    const { code, message, details } = body.error;
    return new ApiError(response.status, code, message, details ?? null);
  }
  const reason = response.statusText ? ` ${response.statusText}` : '';
  return new ApiError(
    response.status,
    `http_${response.status}`,
    `The server answered ${response.status}${reason}. Try again in a moment.`,
  );
}

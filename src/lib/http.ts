/**
 * RAKSHA HTTP client — the single place the frontend talks to FastAPI.
 *
 * - Base URL comes from VITE_API_BASE_URL (see .env.example); no hardcoded hosts.
 * - JWT bearer token from the session store; cleared on 401.
 * - FastAPI error shapes (`detail` string or validation array) surfaced as messages.
 * - Network failures are reported distinctly from server errors so the offline
 *   layer can queue operations instead of pretending they persisted.
 */

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

import { getToken as platformGetToken, setToken as platformSetToken } from "../platform/token";

export const TOKEN_KEY = "raksha.session.v1";

export function getToken(): string | null {
  return platformGetToken();
}

export function setToken(token: string | null): void {
  platformSetToken(token);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

interface RqOpts {
  body?: unknown;
  headers?: Record<string, string>;
  /** Public endpoints (QR) must not clear the session on 401. */
  public?: boolean;
}

export async function rq<T = unknown>(method: string, path: string, opts?: RqOpts): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(opts?.headers ?? {}) };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // fetch rejects on DNS/connection failure — this is the offline signal.
    throw new ApiError(0, "Network error — RAKSHA server unreachable. You appear to be offline.");
  }

  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    const detail = (data as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") msg = detail;
    else if (Array.isArray(detail)) {
      msg = (detail as { loc?: (string | number)[]; msg?: string }[])
        .map(e => `${(e.loc ?? []).slice(1).join(".") || "body"}: ${e.msg ?? "invalid"}`)
        .join("; ");
    }
    if (res.status === 401 && !opts?.public) setToken(null);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

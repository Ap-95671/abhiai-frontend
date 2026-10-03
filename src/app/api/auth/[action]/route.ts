import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";
const COOKIE = "abhiai.refresh-session";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth" };

/** Same-origin bridge keeps refresh credentials out of JS and avoids third-party cookie blocking. */
export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!["login", "refresh", "logout"].includes(action)) return new NextResponse(null, { status: 404 });
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const clear = (response: NextResponse) => {
    response.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  };
  let body;
  try { body = await request.json(); } catch { return reply({ message: "Invalid request." }, 400); }
  if (!body || typeof body !== "object") return reply({ message: "Invalid request." }, 400);
  const refreshToken = request.cookies.get(COOKIE)?.value;
  if (action !== "login" && !refreshToken) return clear(reply({}, action === "logout" ? 200 : 401));
  const rememberMe = body.rememberMe !== false;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${action}${action === "login" ? `?rememberMe=${rememberMe}` : ""}`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(action === "login" ? { email: body.email, password: body.password } : { refreshToken }),
      cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error",
    });
    if (action === "logout") {
      // Keep the cookie on transient failure so logout can be retried and revoked server-side.
      return response.ok ? clear(reply({}, 200)) : reply({ message: "Unable to sign out. Please try again." }, 503);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const result = reply({ message: payload.message ?? "Authentication failed." }, response.status);
      return action === "refresh" && (response.status === 401 || response.status === 400) ? clear(result) : result;
    }
    if (typeof payload.accessToken !== "string" || (action === "login" &&
        (typeof payload.refreshToken !== "string" || !Number.isFinite(payload.refreshExpiresInSeconds)))) {
      return reply({ message: "Invalid session response." }, 502);
    }
    const result = reply({ accessToken: payload.accessToken, tokenType: payload.tokenType, expiresInSeconds: payload.expiresInSeconds }, 200);
    if (action === "login") result.cookies.set(COOKIE, payload.refreshToken, {
      ...cookieOptions, ...(rememberMe ? { maxAge: payload.refreshExpiresInSeconds } : {}),
    });
    return result;
  } catch {
    return reply({ message: "Unable to reach authentication service. Please try again." }, 503);
  }
}

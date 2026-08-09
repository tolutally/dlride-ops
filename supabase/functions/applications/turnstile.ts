const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

type TurnstileResponse = {
  success?: boolean;
  challenge_ts?: string;
};

export async function verifyTurnstileToken(
  token: string,
  clientIp: string,
  secret: string,
  fetchImplementation: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  if (!token || token.length > MAX_TOKEN_LENGTH || !secret) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetchImplementation(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: clientIp,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileResponse;
    if (result.success !== true || !result.challenge_ts) return false;

    const challengeTime = Date.parse(result.challenge_ts);
    if (!Number.isFinite(challengeTime)) return false;

    const tokenAge = now() - challengeTime;
    return tokenAge >= -30_000 && tokenAge <= MAX_TOKEN_AGE_MS;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

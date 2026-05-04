import type { NextRequest } from 'next/server';

export function getInternalAppUrl(request: NextRequest) {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL;

  if (explicitUrl) return explicitUrl.replace(/\/$/, '');

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return request.nextUrl.origin;
}

export function getPushInternalHeaders(secret: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-kuvert-push-secret': secret,
  };

  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassSecret) {
    headers['x-vercel-protection-bypass'] = bypassSecret;
  }

  return headers;
}

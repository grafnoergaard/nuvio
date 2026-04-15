const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const routes = ['/', '/login', '/indstillinger', '/opsparing', '/udgifter'];
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10_000);

async function checkRoute(route) {
  const url = new URL(route, baseUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 200 && response.status < 400) {
      console.log(`OK ${response.status} ${route}`);
      return true;
    }

    console.error(`FAIL ${response.status} ${route}`);
    return false;
  } catch (error) {
    console.error(`FAIL ${route}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const results = await Promise.all(routes.map(checkRoute));

if (results.some(result => !result)) {
  process.exit(1);
}

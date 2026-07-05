#!/usr/bin/env node

// Configures the Clerk instance for the Moleui desktop app via the Clerk
// Backend API (there is no official Clerk CLI for instance settings).
//
//   CLERK_SECRET_KEY=sk_test_... node scripts/configure_clerk_desktop.mjs
//
// It performs two idempotent steps:
//   1. Sets the instance allowed origins so the packaged Electron renderer
//      (served over a loopback http://localhost:<port> origin) and the dev
//      server can complete OAuth redirects. Dev (pk_test_) instances treat
//      localhost as trusted, so the dynamic port does not need to be enumerated.
//   2. Creates or updates the "convex" JWT template (aud: convex) that the app
//      requests with getToken({ template: 'convex' }).

const API_BASE = 'https://api.clerk.com/v1';

const DEFAULT_ORIGINS = ['http://localhost', 'http://localhost:5173', 'http://localhost:30736'];
const CONVEX_TEMPLATE_NAME = 'convex';
const CONVEX_TEMPLATE_CLAIMS = { aud: 'convex' };

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function clerkRequest(secretKey, path, method = 'GET', body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function setAllowedOrigins(secretKey, origins) {
  await clerkRequest(secretKey, '/instance', 'PATCH', { allowed_origins: origins });
  console.log(`Allowed origins set to: ${origins.join(', ')}`);
}

async function upsertConvexTemplate(secretKey) {
  const templates = await clerkRequest(secretKey, '/jwt_templates');
  const list = Array.isArray(templates) ? templates : templates?.data ?? [];
  const existing = list.find((template) => template.name === CONVEX_TEMPLATE_NAME);

  const body = { name: CONVEX_TEMPLATE_NAME, claims: CONVEX_TEMPLATE_CLAIMS };

  const template = existing
    ? await clerkRequest(secretKey, `/jwt_templates/${existing.id}`, 'PATCH', body)
    : await clerkRequest(secretKey, '/jwt_templates', 'POST', body);

  console.log(`${existing ? 'Updated' : 'Created'} JWT template "${template.name}" (${template.id})`);
}

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Set CLERK_SECRET_KEY (sk_test_... or sk_live_...) before running this script.');
  }

  // `--origins` replaces the default list; pass a comma-separated string.
  const originsArg = argValue('--origins', '');
  const origins = originsArg
    ? originsArg.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;

  await setAllowedOrigins(secretKey, origins);
  await upsertConvexTemplate(secretKey);

  console.log('Clerk desktop configuration complete.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

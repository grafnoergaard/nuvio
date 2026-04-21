import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import process from 'node:process';

const TARGET_PROJECT_REF = 'feeumtiziihojcwuvtmw';

function parseArgs() {
  const args = new Map();

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split('=');
    const value = inlineValue ?? process.argv[index + 1];

    if (inlineValue === undefined) index += 1;
    args.set(key, value);
  }

  return args;
}

function readEnvFile() {
  return fs.readFile('.env', 'utf8').catch(() => '');
}

function readEnvValue(envText, name) {
  const match = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match?.[1]?.trim() || process.env[name] || '';
}

async function findUserByEmail(supabase, email) {
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }

  return null;
}

async function main() {
  const args = parseArgs();
  const email = args.get('email');
  const adminValue = args.get('admin') !== 'false';

  if (!email) {
    throw new Error('Brug: node scripts/set-user-admin.mjs --email grafnoergaard@gmail.com --admin true');
  }

  const envText = await readEnvFile();
  const supabaseUrl = readEnvValue(envText, 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = readEnvValue(envText, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl.includes(TARGET_PROJECT_REF)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL skal pege på Kuvert Production (${TARGET_PROJECT_REF}). Nu: ${supabaseUrl || 'mangler'}`);
  }

  if (!serviceRoleKey) {
    throw new Error('Mangler SUPABASE_SERVICE_ROLE_KEY i .env eller shell env.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const user = await findUserByEmail(supabase, email);

  if (!user) {
    throw new Error(`Brugeren ${email} blev ikke fundet i Kuvert Production.`);
  }

  const nextAppMetadata = {
    ...(user.app_metadata ?? {}),
    is_admin: adminValue,
    role: adminValue ? 'admin' : user.app_metadata?.role,
  };

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: nextAppMetadata,
  });

  if (error) {
    throw error;
  }

  console.log(`Opdateret ${email}`);
  console.log(`user_id: ${user.id}`);
  console.log(`is_admin: ${String(data.user.app_metadata?.is_admin)}`);
  console.log(`role: ${String(data.user.app_metadata?.role ?? '')}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

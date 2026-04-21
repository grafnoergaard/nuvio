import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import process from 'node:process';

const TARGET_PROJECT_REF = 'feeumtiziihojcwuvtmw';

const importOrder = [
  'budgets',
  'category_groups',
  'recipients',
  'recipient_rules',
  'merchant_rules',
  'transactions',
  'budget_plans',
  'household',
  'quick_expense_budgets',
  'quick_expense_monthly_budgets',
  'quick_expenses',
  'quick_expense_month_transitions',
  'quick_expense_week_transitions',
  'quick_expense_streaks',
  'user_precision_commitment',
  'flow_savings_totals',
  'flow_savings_entries',
  'savings_goals',
  'investment_settings',
  'mini_checkup_user_state',
  'user_home_card_config',
];

function parseArgs() {
  const args = new Map();

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (!arg.startsWith('--')) {
      args.set('file', arg);
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

function remapUserIds(row, oldUserId, newUserId) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (key === 'user_id' && value === oldUserId) return [key, newUserId];
      return [key, value];
    })
  );
}

function normalizeLegacyRow(table, row) {
  const normalized = { ...row };

  if (table === 'quick_expense_monthly_budgets') {
    if ('weekly_overspend' in normalized && !('weekly_carry_over' in normalized)) {
      normalized.weekly_carry_over = normalized.weekly_overspend ?? 0;
    }
    if ('last_overspend_updated_at' in normalized && !('last_carry_over_updated_at' in normalized)) {
      normalized.last_carry_over_updated_at = normalized.last_overspend_updated_at ?? null;
    }

    delete normalized.weekly_overspend;
    delete normalized.last_overspend_updated_at;
  }

  return normalized;
}

async function upsertRows(supabase, table, rows, dryRun) {
  if (!rows.length) return { inserted: 0, skipped: false };
  if (dryRun) return { inserted: rows.length, skipped: false };

  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });

  if (error) {
    return { inserted: 0, skipped: true, error: error.message };
  }

  return { inserted: rows.length, skipped: false };
}

async function main() {
  const args = parseArgs();
  const exportFile = args.get('file');
  const targetEmail = args.get('target-email');
  const dryRun = args.get('dry-run') !== 'false';

  if (!exportFile) {
    throw new Error('Brug: node scripts/import-old-supabase-user-data.mjs <exports/fil.json> --target-email email@example.com --dry-run true');
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

  const exportData = JSON.parse(await fs.readFile(exportFile, 'utf8'));
  const oldUserId = exportData.user?.id;
  const email = targetEmail || exportData.user?.email;

  if (!oldUserId || !email) {
    throw new Error('Eksportfilen mangler user.id eller user.email.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const targetUser = await findUserByEmail(supabase, email);

  if (!targetUser) {
    throw new Error(`Brugeren ${email} findes ikke i Kuvert Production. Opret den først i Supabase Authentication → Users.`);
  }

  console.log(`Importerer ${exportFile}`);
  console.log(`Gammel user_id: ${oldUserId}`);
  console.log(`Ny user_id:     ${targetUser.id}`);
  console.log(`Mode:           ${dryRun ? 'dry-run' : 'LIVE import'}`);
  console.log('');

  for (const table of importOrder) {
    const rows = exportData.tables?.[table] ?? [];
    const remappedRows = rows.map((row) => normalizeLegacyRow(table, remapUserIds(row, oldUserId, targetUser.id)));
    const result = await upsertRows(supabase, table, remappedRows, dryRun);

    if (result.skipped) {
      console.log(`${table}: sprunget over (${result.error})`);
    } else {
      console.log(`${table}: ${result.inserted} rækker${dryRun ? ' ville blive importeret' : ' importeret'}`);
    }
  }

  if (dryRun) {
    console.log('\nDry-run færdig. Kør igen med --dry-run false for at importere.');
  } else {
    console.log('\nImport færdig.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

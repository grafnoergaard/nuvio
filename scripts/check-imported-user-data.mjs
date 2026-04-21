import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import process from 'node:process';

const TARGET_PROJECT_REF = 'feeumtiziihojcwuvtmw';

const userScopedTables = [
  'household',
  'budgets',
  'category_groups',
  'recipients',
  'recipient_rules',
  'transactions',
  'merchant_rules',
  'quick_expenses',
  'quick_expense_budgets',
  'quick_expense_monthly_budgets',
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
  return process.argv.slice(2).filter(Boolean);
}

async function readEnvFile() {
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

async function countTargetRows(supabase, table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}

async function main() {
  const files = parseArgs();
  if (files.length === 0) {
    throw new Error('Brug: node scripts/check-imported-user-data.mjs exports/fil1.json [exports/fil2.json]');
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

  for (const file of files) {
    const exportData = JSON.parse(await fs.readFile(file, 'utf8'));
    const email = exportData.user?.email;

    if (!email) {
      console.log(`\n${file}: mangler user.email`);
      continue;
    }

    const targetUser = await findUserByEmail(supabase, email);
    console.log(`\n${email}`);
    console.log(`target user: ${targetUser ? 'fundet' : 'mangler'}`);

    if (!targetUser) continue;

    for (const table of userScopedTables) {
      const expected = exportData.tables?.[table]?.length ?? 0;
      const result = await countTargetRows(supabase, table, targetUser.id);
      const actual = result.error ? `FEJL: ${result.error}` : String(result.count);
      const marker = !result.error && result.count === expected ? 'OK' : 'TJEK';
      console.log(`${marker.padEnd(5)} ${table.padEnd(36)} eksport ${String(expected).padStart(3)} -> target ${actual}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';

const OLD_SUPABASE_URL = 'https://rwgfumvdeggtybnnkunl.supabase.co';

const candidateTables = [
  'household',
  'budgets',
  'category_groups',
  'categories',
  'recipients',
  'recipient_rules',
  'transactions',
  'budget_lines',
  'budget_plans',
  'merchant_rules',
  'quick_expenses',
  'quick_expense_budgets',
  'quick_expense_monthly_budgets',
  'quick_expense_month_transitions',
  'quick_expense_streaks',
  'quick_expense_week_transitions',
  'user_precision_commitment',
  'flow_savings_entries',
  'flow_savings_totals',
  'savings_goals',
  'investment_settings',
  'mini_checkup_user_state',
  'user_home_card_config',
];

function readEnvValue(name) {
  const envText = process.env[name] ? `${name}=${process.env[name]}` : '';

  return fs.readFile('.env', 'utf8')
    .catch(() => envText)
    .then((text) => {
      const match = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
      return match?.[1]?.trim() || process.env[name] || '';
    });
}

function getProjectRefFromJwt(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return json.ref || null;
  } catch {
    return null;
  }
}

async function promptHidden(query) {
  process.stdout.write(query);
  emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';

    function cleanup() {
      process.stdin.off('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdout.write('\n');
    }

    function onKeypress(str, key) {
      if (key?.name === 'return' || key?.name === 'enter') {
        cleanup();
        resolve(value);
        return;
      }

      if (key?.ctrl && key?.name === 'c') {
        cleanup();
        reject(new Error('Afbrudt'));
        return;
      }

      if (key?.name === 'backspace') {
        value = value.slice(0, -1);
        return;
      }

      if (str) {
        value += str;
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function fetchAllRows(supabase, table) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select('*').range(from, to);

    if (error) {
      return { rows: [], error: error.message };
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      return { rows, error: null };
    }
  }
}

async function main() {
  const oldAnonKey = await readEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const keyRef = getProjectRefFromJwt(oldAnonKey);

  if (!oldAnonKey) {
    throw new Error('Mangler NEXT_PUBLIC_SUPABASE_ANON_KEY i .env');
  }

  if (keyRef && keyRef !== 'rwgfumvdeggtybnnkunl') {
    throw new Error(`Anon key peger på ${keyRef}, ikke den gamle Supabase.`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await rl.question('Email der skal eksporteres: ')).trim();
  rl.close();

  if (!email) {
    throw new Error('Email mangler');
  }

  const password = await promptHidden('Password til gammel Supabase: ');
  const supabase = createClient(OLD_SUPABASE_URL, oldAnonKey);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    throw new Error(`Login fejlede mod gammel Supabase: ${authError?.message ?? 'Ukendt fejl'}`);
  }

  const exportData = {
    source: OLD_SUPABASE_URL,
    exportedAt: new Date().toISOString(),
    user: {
      id: authData.user.id,
      email: authData.user.email,
    },
    tables: {},
    errors: {},
  };

  for (const table of candidateTables) {
    process.stdout.write(`Eksporterer ${table}... `);
    const result = await fetchAllRows(supabase, table);

    if (result.error) {
      exportData.errors[table] = result.error;
      console.log(`sprunget over (${result.error})`);
      continue;
    }

    exportData.tables[table] = result.rows;
    console.log(`${result.rows.length} rækker`);
  }

  await fs.mkdir('exports', { recursive: true });
  const safeEmail = email.replace(/[^a-z0-9._-]+/gi, '_');
  const fileName = `old-supabase-export-${safeEmail}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outPath = path.join('exports', fileName);

  await fs.writeFile(outPath, JSON.stringify(exportData, null, 2));
  console.log(`\nEksport gemt: ${outPath}`);
  console.log('Denne fil er lokalt ignoreret af Git via exports/.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

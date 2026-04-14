import { supabase } from './supabase';

export interface TypographyToken {
  id: string;
  key: string;
  value: string;
  label: string;
  category: 'font-size' | 'font-weight';
  description: string | null;
}

export const DEFAULT_TYPOGRAPHY_TOKENS: Record<string, string> = {
  'font-size-caption':    '10px',
  'font-size-label':      '11px',
  'font-size-body-sm':    '14px',
  'font-size-body':       '16px',
  'font-size-body-lg':    '18px',
  'font-size-heading-sm': '24px',
  'font-size-heading':    '30px',
  'font-size-heading-lg': '36px',
  'font-size-display':    '48px',
  'font-weight-regular':  '400',
  'font-weight-medium':   '500',
  'font-weight-semibold': '600',
  'font-weight-bold':     '700',
};

export function tokenToCssVar(key: string): string {
  return `--typo-${key}`;
}

export async function fetchTypographyTokens(): Promise<TypographyToken[]> {
  const { data, error } = await supabase
    .from('typography_tokens')
    .select('id, key, value, label, category, description')
    .order('category')
    .order('key');
  if (error) throw error;
  return (data ?? []) as TypographyToken[];
}

export async function bulkUpsertTypographyTokens(
  updates: Array<{ key: string; value: string }>
): Promise<void> {
  const now = new Date().toISOString();
  const results = await Promise.all(
    updates.map(({ key, value }) =>
      supabase
        .from('typography_tokens')
        .update({ value, updated_at: now })
        .eq('key', key)
    )
  );
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}

export async function resetTypographyTokensToDefaults(): Promise<void> {
  await bulkUpsertTypographyTokens(
    Object.entries(DEFAULT_TYPOGRAPHY_TOKENS).map(([key, value]) => ({ key, value }))
  );
}

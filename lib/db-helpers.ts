import { supabase } from './supabase';
import type { Budget, BudgetInsert, BudgetUpdate, CategoryGroup, Category, Transaction, BudgetLine, Recipient, RecipientRule, BudgetPlan } from './database.types';

export async function getBudgets() {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .order('year', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getBudgetsWithTransactionCounts() {
  const budgets = await getBudgets();

  const budgetsWithCounts = await Promise.all(
    (budgets || []).map(async (budget) => {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('budget_id', budget.id);

      return {
        ...budget,
        transaction_count: count || 0,
      };
    })
  );

  return budgetsWithCounts;
}

export async function getBudgetById(id: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createBudget(budget: { name: string; year: number; start_month?: number; end_month?: number }): Promise<Budget> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const insert: BudgetInsert = { ...budget, user_id: user.id } as any;
  const { data, error } = await supabase
    .from('budgets')
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
  const update: BudgetUpdate = { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('budgets')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string) {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function setActiveBudget(id: string): Promise<void> {
  const { error } = await supabase.rpc('set_active_budget', { budget_uuid: id });
  if (error) throw error;
}

export async function getActiveBudgetId(): Promise<string | null> {
  const { data } = await supabase
    .from('budgets')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function duplicateBudget(sourceId: string, newName: string, newYear: number): Promise<Budget> {
  const { data, error } = await supabase.rpc('duplicate_budget', {
    source_id: sourceId,
    new_name: newName,
    new_year: newYear,
  });

  if (error) throw error;
  if (!data) throw new Error('Duplikeringen returnerede intet budget');

  return data as Budget;
}

export async function getCategoryGroups() {
  const { data, error } = await supabase
    .from('category_groups')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function findOrCreateCategoryGroup(name: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('category_groups')
    .select('id')
    .eq('name', name)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('category_groups')
    .insert({ name, user_id: user.id })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

export async function findOrCreateCategory(name: string, categoryGroupId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('name', name)
    .eq('category_group_id', categoryGroupId)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('categories')
    .insert({ name, category_group_id: categoryGroupId })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select(`
      *,
      category_group:category_groups(*)
    `)
    .order('name');

  if (error) throw error;
  return data;
}

export async function getCategoriesByGroup(groupId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('category_group_id', groupId)
    .order('name');

  if (error) throw error;
  return data;
}

export async function batchFindOrCreateCategoryGroups(names: string[]): Promise<Map<string, string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const uniqueNames = Array.from(new Set(names));
  const result = new Map<string, string>();

  if (uniqueNames.length === 0) return result;

  const { data: existing } = await supabase
    .from('category_groups')
    .select('id, name')
    .eq('user_id', user.id)
    .in('name', uniqueNames);

  const existingMap = new Map((existing || []).map(g => [g.name, g.id]));
  uniqueNames.forEach(name => {
    if (existingMap.has(name)) {
      result.set(name, existingMap.get(name)!);
    }
  });

  const toCreate = uniqueNames.filter(name => !existingMap.has(name));
  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from('category_groups')
      .insert(toCreate.map(name => ({ name, user_id: user.id })))
      .select('id, name');

    if (error) throw error;
    (created || []).forEach(g => result.set(g.name, g.id));
  }

  return result;
}

export async function batchFindOrCreateCategories(
  categories: Array<{ name: string; categoryGroupId: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (categories.length === 0) return result;

  const uniqueCategories = Array.from(
    new Map(categories.map(c => [`${c.name}|${c.categoryGroupId}`, c])).values()
  );

  const { data: existing } = await supabase
    .from('categories')
    .select('id, name, category_group_id');

  const existingMap = new Map(
    (existing || []).map(c => [`${c.name}|${c.category_group_id}`, c.id])
  );

  uniqueCategories.forEach(c => {
    const key = `${c.name}|${c.categoryGroupId}`;
    if (existingMap.has(key)) {
      result.set(key, existingMap.get(key)!);
    }
  });

  const toCreate = uniqueCategories.filter(
    c => !existingMap.has(`${c.name}|${c.categoryGroupId}`)
  );

  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from('categories')
      .insert(
        toCreate.map(c => ({
          name: c.name,
          category_group_id: c.categoryGroupId,
        }))
      )
      .select('id, name, category_group_id');

    if (error) throw error;
    (created || []).forEach(c =>
      result.set(`${c.name}|${c.category_group_id}`, c.id)
    );
  }

  return result;
}

export async function batchFindOrCreateRecipients(
  recipients: Array<{ name: string; categoryGroupId: string }>
): Promise<Map<string, string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const result = new Map<string, string>();

  if (recipients.length === 0) return result;

  const uniqueRecipients = Array.from(
    new Map(recipients.map(r => [`${r.name}|${r.categoryGroupId}`, r])).values()
  );

  const { data: existing } = await supabase
    .from('recipients')
    .select('id, name, category_group_id')
    .eq('user_id', user.id);

  const existingMap = new Map(
    (existing || []).map(r => [`${r.name}|${r.category_group_id}`, r.id])
  );

  uniqueRecipients.forEach(r => {
    const key = `${r.name}|${r.categoryGroupId}`;
    if (existingMap.has(key)) {
      result.set(key, existingMap.get(key)!);
    }
  });

  const toCreate = uniqueRecipients.filter(
    r => !existingMap.has(`${r.name}|${r.categoryGroupId}`)
  );

  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from('recipients')
      .insert(
        toCreate.map(r => ({
          name: r.name,
          category_group_id: r.categoryGroupId,
          user_id: user.id,
        }))
      )
      .select('id, name, category_group_id');

    if (error) throw error;
    (created || []).forEach(r =>
      result.set(`${r.name}|${r.category_group_id}`, r.id)
    );
  }

  return result;
}

export async function batchCreateTransactions(
  transactions: Array<{
    budget_id: string;
    date: string;
    description: string;
    recipient_name?: string | null;
    recipient_id?: string | null;
    amount: number;
    category_group_id?: string | null;
  }>
): Promise<number> {
  if (transactions.length === 0) return 0;

  const BATCH_SIZE = 300;
  let totalInserted = 0;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('transactions')
      .insert(batch);

    if (error) throw error;
    totalInserted += batch.length;
  }

  return totalInserted;
}

export async function getBudgetLines(budgetId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('budget_lines')
    .select(`
      *,
      category:categories(
        *,
        category_group:category_groups(*)
      )
    `)
    .eq('budget_id', budgetId);

  if (error) throw error;
  return data || [];
}

export async function upsertBudgetLine(budgetLine: { budget_id: string; category_id: string; amount_planned: number }) {
  const { data, error } = await supabase
    .from('budget_lines')
    .upsert(budgetLine, { onConflict: 'budget_id,category_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTransactions(budgetId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      category_group:category_groups(*),
      recipient:recipients(*, category_group:category_groups(*))
    `)
    .eq('budget_id', budgetId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTransaction(transaction: {
  budget_id: string;
  date: string;
  description: string;
  recipient_name?: string | null;
  recipient_id?: string | null;
  amount: number;
  category_group_id?: string | null;
}) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transaction)
    .select(`
      *,
      category_group:category_groups(*),
      recipient:recipients(*, category_group:category_groups(*))
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id: string, updates: {
  date?: string;
  amount?: number | string;
  recipient_name?: string | null;
  recipient_id?: string | null;
  category_group_id?: string | null;
}) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      category_group:category_groups(*),
      recipient:recipients(*, category_group:category_groups(*))
    `)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMultipleTransactions(ids: string[]) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

export async function syncBudgetLinesFromTransactions(budgetId: string) {
  const transactions = await getTransactions(budgetId);

  if (!transactions || transactions.length === 0) {
    return;
  }

  const unsentTransactions = transactions.filter(t => !t.sent_to_budget);

  if (unsentTransactions.length === 0) {
    return;
  }

  const categoryTotals: Record<string, number> = {};

  unsentTransactions.forEach(transaction => {
    if (transaction.category_id) {
      const amount = parseFloat(transaction.amount.toString());
      categoryTotals[transaction.category_id] = (categoryTotals[transaction.category_id] || 0) + amount;
    }
  });

  for (const [categoryId, totalAmount] of Object.entries(categoryTotals)) {
    await upsertBudgetLine({
      budget_id: budgetId,
      category_id: categoryId,
      amount_planned: totalAmount,
    });
  }

  const transactionIds = unsentTransactions.map(t => t.id);
  await supabase
    .from('transactions')
    .update({ sent_to_budget: true, sent_at: new Date().toISOString() })
    .in('id', transactionIds);
}

export async function syncBudgetPlansFromTransactions(budgetId: string) {
  const transactions = await getTransactions(budgetId);

  if (!transactions || transactions.length === 0) {
    return;
  }

  const unsentTransactions = transactions.filter(t => !t.sent_to_budget);

  if (unsentTransactions.length === 0) {
    return;
  }

  const recipientMonthTotals: Record<string, number> = {};

  unsentTransactions.forEach(transaction => {
    if (transaction.recipient_id && transaction.date) {
      const date = new Date(transaction.date);
      const month = date.getMonth() + 1;
      const key = `${transaction.recipient_id}_${month}`;
      const amount = parseFloat(transaction.amount.toString());
      recipientMonthTotals[key] = (recipientMonthTotals[key] || 0) + amount;
    }
  });

  for (const [key, totalAmount] of Object.entries(recipientMonthTotals)) {
    const [recipientId, monthStr] = key.split('_');
    const month = parseInt(monthStr);

    await upsertBudgetPlan({
      budget_id: budgetId,
      recipient_id: recipientId,
      month: month,
      amount_planned: totalAmount,
    });
  }
}

export async function getRecipients() {
  const { data, error } = await supabase
    .from('recipients')
    .select(`
      *,
      category_group:category_groups(*)
    `)
    .order('name');

  if (error) throw error;
  return data;
}

export async function findOrCreateRecipient(name: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('recipients')
    .select('id')
    .eq('name', name)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('recipients')
    .insert({ name, user_id: user.id })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

export async function updateRecipient(id: string, updates: { name?: string; category_group_id?: string | null }) {
  const { data, error } = await supabase
    .from('recipients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRecipientRules() {
  const { data, error } = await supabase
    .from('recipient_rules')
    .select(`
      *,
      recipient:recipients(*)
    `)
    .order('priority', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createRecipientRule(rule: {
  text_match: string;
  match_type?: 'exact' | 'contains';
  amount_match?: number | null;
  recipient_id: string;
  priority?: number;
}) {
  const { data, error } = await supabase
    .from('recipient_rules')
    .insert(rule)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function applyRecipientRules(text: string, amount: number): Promise<string | null> {
  const rules = await getRecipientRules();

  for (const rule of rules || []) {
    let textMatch = false;

    if (rule.match_type === 'exact') {
      textMatch = rule.text_match === text;
    } else if (rule.match_type === 'contains') {
      textMatch = text.toLowerCase().includes(rule.text_match.toLowerCase());
    }

    if (textMatch) {
      if (rule.amount_match !== null) {
        if (Math.abs(parseFloat(rule.amount_match) - amount) < 0.01) {
          return rule.recipient_id;
        }
      } else {
        return rule.recipient_id;
      }
    }
  }

  return null;
}

export async function getBudgetPlans(budgetId: string) {
  const { data, error } = await supabase
    .from('budget_plans')
    .select(`
      *,
      recipient:recipients(*, category_group:category_groups(*))
    `)
    .eq('budget_id', budgetId)
    .order('month');

  if (error) throw error;
  return data;
}

export async function upsertBudgetPlan(plan: {
  budget_id: string;
  recipient_id: string;
  month: number;
  amount_planned: number;
}) {
  const { data, error } = await supabase
    .from('budget_plans')
    .upsert(plan, { onConflict: 'budget_id,recipient_id,month' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRecipientsByBudget(budgetId: string) {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      recipient_id,
      recipient:recipients(*, category_group:category_groups(*))
    `)
    .eq('budget_id', budgetId)
    .not('recipient_id', 'is', null);

  if (error) throw error;

  const uniqueRecipients = new Map();
  transactions?.forEach(t => {
    if (t.recipient && t.recipient_id) {
      uniqueRecipients.set(t.recipient_id, t.recipient);
    }
  });

  return Array.from(uniqueRecipients.values());
}

export async function getTransactionsByRecipientAndMonth(budgetId: string, recipientId: string, month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('budget_id', budgetId)
    .eq('recipient_id', recipientId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0]);

  if (error) throw error;
  return data;
}

export async function getRecipientCategoryStats(budgetId: string, recipientId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('category_group_id, category_group:category_groups(*)')
    .eq('budget_id', budgetId)
    .eq('recipient_id', recipientId);

  if (error) throw error;

  const categoryGroupCount: Record<string, number> = {};
  let mostCommonCategoryGroupId: string | null = null;
  let maxCount = 0;

  data?.forEach(t => {
    if (t.category_group_id) {
      categoryGroupCount[t.category_group_id] = (categoryGroupCount[t.category_group_id] || 0) + 1;
      if (categoryGroupCount[t.category_group_id] > maxCount) {
        maxCount = categoryGroupCount[t.category_group_id];
        mostCommonCategoryGroupId = t.category_group_id;
      }
    }
  });

  return {
    mostCommonCategoryGroupId,
    hasMixedCategoryGroups: Object.keys(categoryGroupCount).length > 1,
  };
}

export async function getBudgetStructure(budgetId: string) {
  const budget = await getBudgetById(budgetId);
  if (!budget) return null;

  const [transactionRecipients, plans, groups, allTransactions] = await Promise.all([
    getRecipientsByBudget(budgetId),
    getBudgetPlans(budgetId),
    getCategoryGroups(),
    getTransactions(budgetId),
  ]);

  const recipientMap = new Map<string, any>();
  (transactionRecipients || []).forEach(r => recipientMap.set(r.id, r));

  const planOnlyRecipientIds = (plans || [])
    .map(p => p.recipient_id)
    .filter((id): id is string => !!id && !recipientMap.has(id));

  if (planOnlyRecipientIds.length > 0) {
    const uniqueIds = Array.from(new Set(planOnlyRecipientIds));
    const { data } = await supabase
      .from('recipients')
      .select('*, category_group:category_groups(*)')
      .in('id', uniqueIds);
    (data || []).forEach(r => recipientMap.set(r.id, r));
  }

  const recipients = Array.from(recipientMap.values());

  const sentTransactions = (allTransactions || []).filter(t => t.sent_to_budget === true);

  const recipientTransactionsMap = new Map<string, any[]>();
  const noRecipientTransactionsByGroup = new Map<string, any[]>();

  sentTransactions.forEach(t => {
    if (t.recipient_id) {
      if (!recipientTransactionsMap.has(t.recipient_id)) {
        recipientTransactionsMap.set(t.recipient_id, []);
      }
      recipientTransactionsMap.get(t.recipient_id)!.push(t);
    } else if (t.category_group_id) {
      if (!noRecipientTransactionsByGroup.has(t.category_group_id)) {
        noRecipientTransactionsByGroup.set(t.category_group_id, []);
      }
      noRecipientTransactionsByGroup.get(t.category_group_id)!.push(t);
    }
  });

  const structure: any = {
    categoryGroups: [],
  };

  for (const group of groups || []) {
    const recipientsInGroup = (recipients || []).filter(r => r.category_group_id === group.id);
    const noRecipientTxs = noRecipientTransactionsByGroup.get(group.id) || [];

    if (recipientsInGroup.length === 0 && noRecipientTxs.length === 0) continue;

    const recipientsList = recipientsInGroup.map(recipient => {
      const monthlyPlans: Record<number, number> = {};
      const monthlyActuals: Record<number, number> = {};

      for (let month = 1; month <= 12; month++) {
        const plan = plans?.find(p => p.recipient_id === recipient.id && p.month === month);
        monthlyPlans[month] = plan ? parseFloat(plan.amount_planned) : 0;

        const transactions = recipientTransactionsMap.get(recipient.id) || [];
        const monthStart = new Date(budget.year, month - 1, 1);
        const monthEnd = new Date(budget.year, month, 0);

        monthlyActuals[month] = transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate <= monthEnd;
          })
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      return {
        ...recipient,
        monthlyPlans,
        monthlyActuals,
        hasMixedCategories: false,
      };
    });

    if (noRecipientTxs.length > 0) {
      const monthlyPlans: Record<number, number> = {};
      const monthlyActuals: Record<number, number> = {};

      for (let month = 1; month <= 12; month++) {
        monthlyPlans[month] = 0;

        const monthStart = new Date(budget.year, month - 1, 1);
        const monthEnd = new Date(budget.year, month, 0);

        monthlyActuals[month] = noRecipientTxs
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate <= monthEnd;
          })
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      recipientsList.push({
        id: `no-recipient-${group.id}`,
        name: 'Diverse posteringer',
        category_group_id: group.id,
        created_at: new Date().toISOString(),
        monthlyPlans,
        monthlyActuals,
        hasMixedCategories: false,
      });
    }

    const categoryData = [{
      id: group.id,
      name: group.name,
      category_group_id: group.id,
      created_at: group.created_at,
      recipients: recipientsList,
    }];

    structure.categoryGroups.push({
      ...group,
      categories: categoryData,
    });
  }

  const uncategorizedRecipients = (recipients || []).filter(r => !r.category_group_id);
  const noRecipientNoGroup = sentTransactions.filter(t => !t.recipient_id && !t.category_group_id);

  if (uncategorizedRecipients.length > 0 || noRecipientNoGroup.length > 0) {
    const recipientsList = uncategorizedRecipients.map(recipient => {
      const monthlyPlans: Record<number, number> = {};
      const monthlyActuals: Record<number, number> = {};

      for (let month = 1; month <= 12; month++) {
        const plan = plans?.find(p => p.recipient_id === recipient.id && p.month === month);
        monthlyPlans[month] = plan ? parseFloat(plan.amount_planned) : 0;

        const transactions = recipientTransactionsMap.get(recipient.id) || [];
        const monthStart = new Date(budget.year, month - 1, 1);
        const monthEnd = new Date(budget.year, month, 0);

        monthlyActuals[month] = transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate <= monthEnd;
          })
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      return {
        ...recipient,
        monthlyPlans,
        monthlyActuals,
        hasMixedCategories: false,
      };
    });

    if (noRecipientNoGroup.length > 0) {
      const monthlyPlans: Record<number, number> = {};
      const monthlyActuals: Record<number, number> = {};

      for (let month = 1; month <= 12; month++) {
        monthlyPlans[month] = 0;

        const monthStart = new Date(budget.year, month - 1, 1);
        const monthEnd = new Date(budget.year, month, 0);

        monthlyActuals[month] = noRecipientNoGroup
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate <= monthEnd;
          })
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      recipientsList.push({
        id: 'no-recipient-no-group',
        name: 'Ukategoriserede posteringer',
        category_group_id: null,
        created_at: new Date().toISOString(),
        monthlyPlans,
        monthlyActuals,
        hasMixedCategories: false,
      });
    }

    structure.categoryGroups.push({
      id: 'uncategorized',
      name: 'Ukategoriseret',
      created_at: new Date().toISOString(),
      categories: [
        {
          id: 'uncategorized',
          name: 'Ingen kategori',
          category_group_id: 'uncategorized',
          created_at: new Date().toISOString(),
          recipients: recipientsList,
        },
      ],
    });
  }

  return structure;
}

export async function renameCategoryGroup(id: string, newName: string) {
  const { error } = await supabase
    .from('category_groups')
    .update({ name: newName })
    .eq('id', id);

  if (error) throw error;
}

export async function getCategoryGroupWithCounts(id: string): Promise<{
  recipientCount: number;
  transactionCount: number;
}> {
  const { data: recipients } = await supabase
    .from('recipients')
    .select('id')
    .eq('category_group_id', id);

  const { count: txCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_group_id', id);

  return {
    recipientCount: recipients?.length ?? 0,
    transactionCount: txCount ?? 0,
  };
}

export async function deleteCategoryGroupWithReassign(
  groupId: string,
  targetGroupId: string | null
) {
  if (targetGroupId) {
    await supabase
      .from('recipients')
      .update({ category_group_id: targetGroupId })
      .eq('category_group_id', groupId);

    await supabase
      .from('transactions')
      .update({ category_group_id: targetGroupId, category_id: null })
      .eq('category_group_id', groupId);
  } else {
    await supabase
      .from('recipients')
      .update({ category_group_id: null })
      .eq('category_group_id', groupId);

    await supabase
      .from('transactions')
      .update({ category_group_id: null, category_id: null })
      .eq('category_group_id', groupId);
  }

  const { error } = await supabase
    .from('category_groups')
    .delete()
    .eq('id', groupId);

  if (error) throw error;
}

export async function createCategoryGroup(name: string, isIncome = false): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('category_groups')
    .insert({ name, is_income: isIncome, user_id: user.id })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

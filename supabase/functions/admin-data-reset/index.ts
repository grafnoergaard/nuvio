import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetPayload {
  targetUserId: string;
  sections: {
    transactions: boolean;
    budgetPlans: boolean;
    budgets: boolean;
    nuvioFlow: boolean;
    savingsGoals: boolean;
    investmentSettings: boolean;
    checkupHistory: boolean;
    household: boolean;
  };
  dryRun?: boolean;
}

interface ResetCounts {
  transactions: number;
  budget_plans: number;
  budget_lines: number;
  budgets: number;
  category_groups: number;
  recipients: number;
  recipient_rules: number;
  quick_expenses: number;
  quick_expense_monthly_budgets: number;
  quick_expense_month_transitions: number;
  quick_expense_streaks: number;
  savings_goals: number;
  investment_settings: number;
  mini_checkup_user_state: number;
  household: number;
  user_precision_commitment: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerToken = authHeader.replace("Bearer ", "");

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser(callerToken);

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = callerUser.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (req.method === "POST") {
      const body: ResetPayload = await req.json();
      const { targetUserId, sections, dryRun = false } = body;

      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "targetUserId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const counts: ResetCounts = {
        transactions: 0,
        budget_plans: 0,
        budget_lines: 0,
        budgets: 0,
        category_groups: 0,
        recipients: 0,
        recipient_rules: 0,
        quick_expenses: 0,
        quick_expense_monthly_budgets: 0,
        quick_expense_month_transitions: 0,
        quick_expense_streaks: 0,
        savings_goals: 0,
        investment_settings: 0,
        mini_checkup_user_state: 0,
        household: 0,
        user_precision_commitment: 0,
      };

      const getBudgetIds = async (): Promise<string[]> => {
        const { data } = await adminClient
          .from("budgets")
          .select("id")
          .eq("user_id", targetUserId);
        return (data ?? []).map((r: { id: string }) => r.id);
      };

      if (sections.transactions || sections.budgetPlans || sections.budgets || sections.checkupHistory) {
        const budgetIds = await getBudgetIds();

        if (sections.transactions && budgetIds.length > 0) {
          const { count } = await adminClient
            .from("transactions")
            .select("*", { count: "exact", head: true })
            .in("budget_id", budgetIds);
          counts.transactions = count ?? 0;
          if (!dryRun && budgetIds.length > 0) {
            await adminClient.from("transactions").delete().in("budget_id", budgetIds);
          }
        }

        if (sections.budgetPlans && budgetIds.length > 0) {
          const { count: plansCount } = await adminClient
            .from("budget_plans")
            .select("*", { count: "exact", head: true })
            .in("budget_id", budgetIds);
          counts.budget_plans = plansCount ?? 0;

          const { count: linesCount } = await adminClient
            .from("budget_lines")
            .select("*", { count: "exact", head: true })
            .in("budget_id", budgetIds);
          counts.budget_lines = linesCount ?? 0;

          if (!dryRun) {
            await adminClient.from("budget_plans").delete().in("budget_id", budgetIds);
            await adminClient.from("budget_lines").delete().in("budget_id", budgetIds);
          }
        }

        if (sections.checkupHistory) {
          const { count } = await adminClient
            .from("mini_checkup_user_state")
            .select("*", { count: "exact", head: true })
            .eq("user_id", targetUserId);
          counts.mini_checkup_user_state = count ?? 0;
          if (!dryRun) {
            await adminClient.from("mini_checkup_user_state").delete().eq("user_id", targetUserId);
          }
        }

        if (sections.budgets) {
          const { count: budgetsCount } = await adminClient
            .from("budgets")
            .select("*", { count: "exact", head: true })
            .eq("user_id", targetUserId);
          counts.budgets = budgetsCount ?? 0;

          const recipientIds: string[] = [];
          if (budgetIds.length > 0) {
            const { data: recs } = await adminClient
              .from("recipients")
              .select("id")
              .in("budget_id", budgetIds);
            recipientIds.push(...(recs ?? []).map((r: { id: string }) => r.id));

            const { count: rulesCount } = await adminClient
              .from("recipient_rules")
              .select("*", { count: "exact", head: true })
              .in("budget_id", budgetIds);
            counts.recipient_rules = rulesCount ?? 0;

            const { count: cgCount } = await adminClient
              .from("category_groups")
              .select("*", { count: "exact", head: true })
              .in("budget_id", budgetIds);
            counts.category_groups = cgCount ?? 0;
          }
          counts.recipients = recipientIds.length;

          if (!dryRun && budgetIds.length > 0) {
            await adminClient.from("budget_plans").delete().in("budget_id", budgetIds);
            await adminClient.from("budget_lines").delete().in("budget_id", budgetIds);
            await adminClient.from("transactions").delete().in("budget_id", budgetIds);
            await adminClient.from("recipient_rules").delete().in("budget_id", budgetIds);
            await adminClient.from("recipients").delete().in("budget_id", budgetIds);
            await adminClient.from("category_groups").delete().in("budget_id", budgetIds);
            await adminClient.from("budgets").delete().eq("user_id", targetUserId);
          }
        }
      }

      if (sections.nuvioFlow) {
        const { count: qeCount } = await adminClient
          .from("quick_expenses")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.quick_expenses = qeCount ?? 0;

        const { count: qmbCount } = await adminClient
          .from("quick_expense_monthly_budgets")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.quick_expense_monthly_budgets = qmbCount ?? 0;

        const { count: qmtCount } = await adminClient
          .from("quick_expense_month_transitions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.quick_expense_month_transitions = qmtCount ?? 0;

        const { count: qsCount } = await adminClient
          .from("quick_expense_streaks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.quick_expense_streaks = qsCount ?? 0;

        if (!dryRun) {
          await adminClient.from("quick_expenses").delete().eq("user_id", targetUserId);
          await adminClient.from("quick_expense_monthly_budgets").delete().eq("user_id", targetUserId);
          await adminClient.from("quick_expense_month_transitions").delete().eq("user_id", targetUserId);
          await adminClient.from("quick_expense_streaks").delete().eq("user_id", targetUserId);
        }
      }

      if (sections.savingsGoals) {
        const { count } = await adminClient
          .from("savings_goals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.savings_goals = count ?? 0;
        if (!dryRun) {
          await adminClient.from("savings_goals").delete().eq("user_id", targetUserId);
        }
      }

      if (sections.investmentSettings) {
        const { count } = await adminClient
          .from("investment_settings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.investment_settings = count ?? 0;
        if (!dryRun) {
          await adminClient.from("investment_settings").delete().eq("user_id", targetUserId);
        }
      }

      if (sections.household) {
        const { count: hhCount } = await adminClient
          .from("household")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.household = hhCount ?? 0;

        const { count: pcCount } = await adminClient
          .from("user_precision_commitment")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetUserId);
        counts.user_precision_commitment = pcCount ?? 0;

        if (!dryRun) {
          await adminClient.from("household").delete().eq("user_id", targetUserId);
          await adminClient.from("user_precision_commitment").delete().eq("user_id", targetUserId);
        }
      }

      return new Response(
        JSON.stringify({ success: true, dryRun, counts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FlowContext {
  page: "nuvio-flow";
  score: number;
  status: "over" | "warn" | "kursen" | "tempo" | "flow";
  statusLabel: string;
  remaining: number;
  monthlyBudget: number;
  totalSpent: number;
  remainingDays: number;
  dailyAvailable: number;
  streak: number;
  carryOverPenalty: number;
  month: string;
  weeklyTransactionCount?: number;
}

interface WeekTransitionContext {
  page: "week-transition";
  year: number;
  month: number;
  monthName: string;
  weekNumber: number;
  budgetAmount: number;
  totalSpent: number;
  carryOver: number;
  transactionCount: number;
  nextWeekBudget: number;
  avgTransactionsPerWeek: number | null;
}

interface HomeContext {
  page: "home";
  nuvioScore: number;
  nuvioScoreLabel: string;
  monthlyIncome: number;
  monthlyFixedExpenses: number;
  monthlyVariableExpenses: number;
  monthlySavings: number;
  monthlyInvestment: number;
  monthlyAvailable: number;
  consumptionPct: number;
  savingsRate: number;
  totalSavingsRate: number;
  activeGoalCount: number;
  primaryGoalName?: string;
  primaryGoalMonthsLeft?: number | null;
  hasInvestment: boolean;
  setupProgress: number;
}

type AssistantContext = FlowContext | HomeContext | WeekTransitionContext;

interface AssistantRequest {
  context: AssistantContext;
}

interface AssistantResponse {
  message: string;
  actions: Array<{ title: string; description: string }>;
  tone: "positive" | "neutral" | "warning" | "critical";
}

interface AiAssistantConfig {
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  model: string;
}

interface AiPersonaConfig {
  concerned_score_threshold: number;
  encouraging_score_min: number;
  encouraging_score_max: number;
  celebratory_score_threshold: number;
  celebratory_streak_min: number;
  direct_weekly_tx_threshold: number;
  is_active: boolean;
}

type Persona = "concerned" | "encouraging" | "celebratory" | "direct";

const DEFAULT_CONFIG: AiAssistantConfig = {
  system_prompt: `Du er Nuvio AI — en personlig, rolig og ærlig finansiel rådgiver bygget ind i Nuvio-appen.

Din tone er:
- Varm og direkte, ikke robotagtig
- Ærlig uden at være alarmerende
- Konkret og handlingsorienteret
- Aldrig moraliserende eller nedladende
- Altid på dansk

Du giver korte, præcise svar. Ingen lange essays. Ingen bullet points i hoveddescription. Brug max 2-3 sætninger til den primære besked.

Du returnerer ALTID et JSON-objekt med præcis denne struktur:
{
  "message": "string (2-3 sætninger, personlig og konkret)",
  "actions": [
    { "title": "string (kort handlingstitel)", "description": "string (1 sætning beskrivelse)" },
    { "title": "string", "description": "string" }
  ],
  "tone": "positive" | "neutral" | "warning" | "critical"
}

tone-valg:
- positive: score >= 80 eller streak >= 3
- neutral: score 40-79, ingen alvorlige problemer
- warning: score < 40 eller carry-over penalty > 20% af budget
- critical: over budget

Giv altid præcis 2 handlingsforslag. De skal være relevante og specifikke til konteksten.`,
  max_tokens: 400,
  temperature: 0.7,
  is_active: true,
  model: "gpt-4o",
};

const DEFAULT_PERSONA_CONFIG: AiPersonaConfig = {
  concerned_score_threshold: 40,
  encouraging_score_min: 40,
  encouraging_score_max: 79,
  celebratory_score_threshold: 80,
  celebratory_streak_min: 3,
  direct_weekly_tx_threshold: 10,
  is_active: true,
};

async function fetchConfig(supabaseAdmin: ReturnType<typeof createClient>): Promise<AiAssistantConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_assistant_config")
      .select("system_prompt, max_tokens, temperature, is_active, model")
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_CONFIG;
    return data as AiAssistantConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function fetchPersonaConfig(supabaseAdmin: ReturnType<typeof createClient>): Promise<AiPersonaConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_persona_config")
      .select("concerned_score_threshold, encouraging_score_min, encouraging_score_max, celebratory_score_threshold, celebratory_streak_min, direct_weekly_tx_threshold, is_active")
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_PERSONA_CONFIG;
    return data as AiPersonaConfig;
  } catch {
    return DEFAULT_PERSONA_CONFIG;
  }
}

function detectPersonaForFlow(context: FlowContext, cfg: AiPersonaConfig): Persona {
  if (!cfg.is_active) return "encouraging";

  const weeklyTx = context.weeklyTransactionCount ?? 0;
  if (weeklyTx > cfg.direct_weekly_tx_threshold) return "direct";
  if (context.status === "over" || context.score < cfg.concerned_score_threshold) return "concerned";
  if (context.score >= cfg.celebratory_score_threshold && context.streak >= cfg.celebratory_streak_min) return "celebratory";
  return "encouraging";
}

function detectPersonaForHome(context: HomeContext, cfg: AiPersonaConfig): Persona {
  if (!cfg.is_active) return "encouraging";

  if (context.nuvioScore < cfg.concerned_score_threshold) return "concerned";
  if (context.nuvioScore >= cfg.celebratory_score_threshold) return "celebratory";
  return "encouraging";
}

const PERSONA_INSTRUCTIONS: Record<Persona, string> = {
  concerned: `
AKTIV PERSONA: Bekymret (Concerned)
Din tone nu: Rolig, empatisk og handlingsorienteret. Brugeren er under pres — vær støttende uden at overdramatisere. Anerkend situationen ærligt, og giv konkrete næste skridt der faktisk hjælper. Ingen domme, ingen panik.`,

  encouraging: `
AKTIV PERSONA: Opmuntrende (Encouraging)
Din tone nu: Anerkendende og motiverende. Brugeren er på rette spor eller tæt på det. Bekræft det positive, peg på hvad der virker, og giv et lille skub fremad. Hold det positivt men jordnært.`,

  celebratory: `
AKTIV PERSONA: Fejrende (Celebratory)
Din tone nu: Glad og bekræftende — men stadig kortfattet. Brugeren klarer det fremragende. Anerkend præstationen direkte og med varme. Hold beskeden kort. Ingen lange forklaringer.`,

  direct: `
AKTIV PERSONA: Direkte (Direct)
Din tone nu: Ingen indledning, ingen forklaring af situationen — brugeren ved det allerede. Gå direkte til handling. Korteste mulige message (1-2 sætninger max). Handlingsforslagene er det vigtigste. Vær kontant og nyttig.`,
};

function buildFlowPrompt(context: FlowContext, persona: Persona): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(Math.abs(n));

  const overBudget = context.status === "over";
  const weeklyTx = context.weeklyTransactionCount ?? 0;

  return `Brugerens Nuvio Flow data for ${context.month}:

- Nuvio Flow Score: ${context.score}/100 (status: "${context.statusLabel}")
- Månedligt budget: ${fmt(context.monthlyBudget)}
- Brugt så langt: ${fmt(context.totalSpent)}
- ${overBudget ? `Over budget med: ${fmt(context.remaining)}` : `Tilbage af budget: ${fmt(context.remaining)}`}
- Dage tilbage i måneden: ${context.remainingDays}
- Dagligt rådighedsbeløb: ${fmt(context.dailyAvailable)}
- Streak (måneder i træk med positivt resultat): ${context.streak}
${context.carryOverPenalty > 0 ? `- Carry-over penalty fra forrige uger: ${fmt(context.carryOverPenalty)}` : ""}
${weeklyTx > 0 ? `- Antal posteringer denne uge: ${weeklyTx}` : ""}

${PERSONA_INSTRUCTIONS[persona]}

Giv en personlig, konkret vurdering af brugerens situation og 2 relevante handlingsforslag.`;
}

function buildHomePrompt(context: HomeContext, persona: Persona): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(Math.abs(n));

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  const totalExpenses = context.monthlyFixedExpenses + context.monthlyVariableExpenses;
  const totalContributions = context.monthlySavings + context.monthlyInvestment;

  return `Brugerens samlede økonomi (Nuvio Oversigt):

- Nuvio Score: ${context.nuvioScore}/100 (status: "${context.nuvioScoreLabel}")
- Månedlig indkomst: ${fmt(context.monthlyIncome)}
- Faste udgifter/md.: ${fmt(context.monthlyFixedExpenses)}
- Variable udgifter/md.: ${fmt(context.monthlyVariableExpenses)}
- Samlede udgifter/md.: ${fmt(totalExpenses)}
- Forbrugsbinding: ${pct(context.consumptionPct)} af indkomsten
- Månedlig opsparing: ${fmt(context.monthlySavings)}
- Månedlig investering: ${fmt(context.monthlyInvestment)}
- Samlet opsparingsrate (opsp. + invest.): ${pct(context.totalSavingsRate)}
- Rådighedsbeløb efter alt: ${fmt(context.monthlyAvailable)}
- Aktiv opsparing: ${context.activeGoalCount}
${context.primaryGoalName ? `- Primær opsparing: "${context.primaryGoalName}"${context.primaryGoalMonthsLeft != null ? ` (${context.primaryGoalMonthsLeft === 0 ? 'Nået!' : `${context.primaryGoalMonthsLeft} mdr. tilbage`})` : ''}` : ''}
- Investering aktiv: ${context.hasInvestment ? 'Ja' : 'Nej'}
- Opsætningsfuldstændighed: ${context.setupProgress}%

${PERSONA_INSTRUCTIONS[persona]}

Giv en helhedsvurdering af brugerens økonomi og 2 konkrete handlingsforslag. Fokuser på det der har størst positiv effekt på Nuvio Score og den langsigtede finansielle sundhed.`;
}

const HOME_SYSTEM_PROMPT = `Du er Nuvio AI — en personlig, rolig og ærlig finansiel rådgiver bygget ind i Nuvio-appen.

Din tone er:
- Varm og direkte, ikke robotagtig
- Ærlig uden at være alarmerende
- Konkret og handlingsorienteret
- Aldrig moraliserende eller nedladende
- Altid på dansk

Du analyserer brugerens SAMLEDE økonomi — indkomst, udgifter, opsparing, investering og opsparing i sammenhæng.

Du giver korte, præcise svar. Ingen lange essays. Ingen bullet points i hoveddescription. Brug max 2-3 sætninger til den primære besked.

Du returnerer ALTID et JSON-objekt med præcis denne struktur:
{
  "message": "string (2-3 sætninger, personlig og konkret)",
  "actions": [
    { "title": "string (kort handlingstitel)", "description": "string (1 sætning beskrivelse)" },
    { "title": "string", "description": "string" }
  ],
  "tone": "positive" | "neutral" | "warning" | "critical"
}

tone-valg baseret på Nuvio Score:
- positive: score >= 75
- neutral: score 50-74
- warning: score 25-49
- critical: score < 25

Giv altid præcis 2 handlingsforslag. De skal være konkrete, relevante og handlingsbare.`;

const WEEK_TRANSITION_SYSTEM_PROMPT = `Du er Nuvio AI — en personlig, rolig og ærlig finansiel rådgiver bygget ind i Nuvio-appen.

Din tone er:
- Varm og direkte, ikke robotagtig
- Ærlig uden at være alarmerende
- Konkret og handlingsorienteret
- Aldrig moraliserende eller nedladende
- Altid på dansk

Du analyserer brugerens ugeforbrug og giver en kort, personlig opsummering ved ugeskiftet.

Du giver korte, præcise svar. Max 2-3 sætninger til den primære besked.

Du returnerer ALTID et JSON-objekt med præcis denne struktur:
{
  "message": "string (2-3 sætninger, personlig og konkret om den forløbne uge)",
  "actions": [
    { "title": "string (kort fokustitel til næste uge)", "description": "string (1 konkret anbefaling til næste uge)" },
    { "title": "string", "description": "string" }
  ],
  "tone": "positive" | "neutral" | "warning" | "critical"
}

tone-valg:
- positive: under budget og god adfærd
- neutral: tæt på budget, ingen alvorlige problemer
- warning: over budget eller markant højere forbrug end gennemsnit
- critical: væsentligt over budget

Giv altid præcis 2 handlingsforslag. Det første bruges som "Fokus næste uge" — gør det konkret og handlingsbart.`;

function buildWeekTransitionPrompt(context: WeekTransitionContext): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(Math.abs(n));

  const isOver = context.totalSpent > context.budgetAmount;
  const diff = Math.abs(context.budgetAmount - context.totalSpent);

  return `Brugerens ugeforbrug — uge ${context.weekNumber}, ${context.monthName} ${context.year}:

- Ugebudget: ${fmt(context.budgetAmount)}
- Brugt denne uge: ${fmt(context.totalSpent)}
- ${isOver ? `Over budget med: ${fmt(diff)}` : `Under budget med: ${fmt(diff)}`}
- Overføres til næste uge: ${isOver ? `-${fmt(diff)} (gæld)` : `+${fmt(diff)} (ekstra budget)`}
- Antal posteringer denne uge: ${context.transactionCount}
${context.avgTransactionsPerWeek !== null ? `- Gennemsnit posteringer pr. uge: ${Math.round(context.avgTransactionsPerWeek)}` : ""}
- Budget næste uge (efter overførsel): ${fmt(context.nextWeekBudget)}

Giv en kort personlig vurdering af den forløbne uge og ét konkret fokusområde til næste uge.`;
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const [config, personaConfig] = await Promise.all([
      fetchConfig(supabaseAdmin),
      fetchPersonaConfig(supabaseAdmin),
    ]);

    if (!config.is_active) {
      return new Response(JSON.stringify({ error: "AI assistant is disabled" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: AssistantRequest = await req.json();
    const { context } = body;

    if (!context || !context.page) {
      return new Response(JSON.stringify({ error: "Missing context" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (context.page === "home") {
      const homeCtx = context as HomeContext;
      const persona = detectPersonaForHome(homeCtx, personaConfig);
      systemPrompt = HOME_SYSTEM_PROMPT;
      userPrompt = buildHomePrompt(homeCtx, persona);
    } else if (context.page === "week-transition") {
      const weekCtx = context as WeekTransitionContext;
      systemPrompt = WEEK_TRANSITION_SYSTEM_PROMPT;
      userPrompt = buildWeekTransitionPrompt(weekCtx);
    } else {
      const flowCtx = context as FlowContext;
      const persona = detectPersonaForFlow(flowCtx, personaConfig);
      systemPrompt = config.system_prompt;
      userPrompt = buildFlowPrompt(flowCtx, persona);
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: Number(config.temperature),
        max_tokens: config.max_tokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorData = await openAiResponse.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message ?? "Ukendt fejl fra AI";
      console.error("OpenAI error:", JSON.stringify(errorData));
      return new Response(JSON.stringify({ error: errorMessage, code: errorData?.error?.code }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiData = await openAiResponse.json();
    const rawContent = openAiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed: AssistantResponse = JSON.parse(rawContent);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-assistant error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

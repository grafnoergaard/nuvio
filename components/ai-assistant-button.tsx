'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, TrendingUp, ShieldCheck, Target, ChevronRight, Loader as Loader2, TriangleAlert as AlertTriangle } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import { useAiContext } from '@/lib/ai-context';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export interface FlowAiContext {
  page: 'nuvio-flow';
  score: number;
  status: 'over' | 'warn' | 'kursen' | 'tempo' | 'flow';
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

export interface HomeAiContext {
  page: 'home';
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

export type AiContext = FlowAiContext | HomeAiContext;

interface AiResponse {
  message: string;
  actions: Array<{ title: string; description: string }>;
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
}

const toneIcons: Record<AiResponse['tone'], typeof TrendingUp> = {
  positive: TrendingUp,
  neutral: Target,
  warning: ShieldCheck,
  critical: AlertTriangle,
};

const toneColors: Record<AiResponse['tone'], { bg: string; text: string; border: string }> = {
  positive: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  neutral: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-100' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
};

async function fetchAiResponse(context: AiContext): Promise<AiResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? supabaseAnonKey;

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ context }),
  });

  const text = await res.text();

  if (!res.ok) {
    let message = `AI fejl (${res.status})`;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      message = json.error ?? json.message ?? message;
    } catch {
      if (text.length > 0 && text.length < 200) message = text;
    }
    throw new Error(message);
  }

  return JSON.parse(text) as AiResponse;
}

function AiModal({ onClose, context }: { onClose: () => void; context?: AiContext }) {
  const { design } = useSettings();
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);

  useEffect(() => {
    if (context && !hasRequested) {
      setLoading(true);
      setHasRequested(true);
      fetchAiResponse(context)
        .then(setAiResponse)
        .catch((err) => setError(err instanceof Error ? err.message : 'Kunne ikke hente AI-svar. Prøv igen.'))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleActionClick = async (actionIndex?: number) => {
    if (!context || hasRequested) return;
    setLoading(true);
    setError(null);
    setHasRequested(true);
    try {
      const response = await fetchAiResponse(context);
      setAiResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente AI-svar. Prøv igen.');
      setHasRequested(false);
    } finally {
      setLoading(false);
    }
  };

  const tone = aiResponse?.tone ?? 'neutral';
  const ToneIcon = toneIcons[tone];
  const toneStyle = toneColors[tone];

  const isHomePage = context?.page === 'home';

  const defaultActions = isHomePage
    ? [
        {
          icon: TrendingUp,
          title: 'Analyser min Kuvert Score',
          desc: 'Hvad driver min score og hvordan forbedrer jeg den?',
        },
        {
          icon: Target,
          title: 'Hvad skal jeg prioritere?',
          desc: 'Personlige anbefalinger baseret på min økonomi',
        },
        {
          icon: ShieldCheck,
          title: 'Optimer min opsparing',
          desc: 'Konkrete råd til at øge min opsparingsrate',
        },
      ]
    : [
        {
          icon: TrendingUp,
          title: 'Analyser min Score',
          desc: 'Få en personlig vurdering af din nuværende score',
        },
        {
          icon: Target,
          title: 'Hvad skal jeg fokusere på?',
          desc: 'Konkrete næste skridt baseret på dine tal',
        },
        {
          icon: ShieldCheck,
          title: 'Hjælp mig holde budgettet',
          desc: 'Råd til at holde kursen resten af måneden',
        },
      ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 300ms cubic-bezier(0.22,1,0.36,1) forwards' }}
      >
        <div
          className="px-6 pt-6 pb-5"
          style={{ background: `linear-gradient(135deg, ${design.gradientFrom}22, ${design.gradientTo}11)` }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 rounded-sm flex items-center justify-center shadow-sm overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})` }}
              >
                {design.logoUrl ? (
                  <img src={design.logoUrl} alt="Kuvert" className="object-contain" style={{ width: 36, height: 36 }} />
                ) : (
                  <Sparkles className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Kuvert AI</p>
                <p className="text-xs text-muted-foreground">Din finansielle rådgiver</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground/50 hover:text-muted-foreground hover:bg-black/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-white/70 backdrop-blur rounded-2xl px-4 py-3 border border-white/60 min-h-[72px] flex items-start gap-3">
            {loading ? (
              <div className="flex items-center gap-2 w-full">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: design.gradientFrom }} />
                <p className="text-sm text-slate-500 leading-relaxed">{isHomePage ? 'Analyserer din samlede økonomi...' : 'Analyserer din økonomi...'}</p>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 w-full">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
              </div>
            ) : aiResponse ? (
              <div className="w-full">
                <div className={`flex items-start gap-2 p-3 rounded-xl ${toneStyle.bg} border ${toneStyle.border} mb-3`}>
                  <ToneIcon className={`h-4 w-4 shrink-0 mt-0.5 ${toneStyle.text}`} />
                  <p className={`text-sm leading-relaxed ${toneStyle.text}`}>{aiResponse.message}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed">
                {context?.page === 'home'
                  ? 'Vælg et emne nedenfor for at få en personlig analyse af din samlede økonomi.'
                  : context
                  ? 'Vælg et emne nedenfor for at få en personlig analyse baseret på din aktuelle score.'
                  : 'Hej! Jeg er din personlige finansielle assistent. Åbn en side for at få kontekstbaserede indsigter.'}
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-2">
          {aiResponse ? (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Foreslåede handlinger</p>
              {aiResponse.actions.map((action, i) => (
                <div
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-left"
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${design.gradientFrom}33, ${design.gradientTo}22)` }}
                  >
                    <ChevronRight className="h-4 w-4" style={{ color: design.gradientFrom }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium tracking-tight">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setAiResponse(null); setHasRequested(false); }}
                className="w-full mt-2 text-xs text-muted-foreground hover:text-slate-600 transition-colors py-1"
              >
                Stil et nyt spørgsmål
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Hvad kan jeg hjælpe med?</p>
              {defaultActions.map(({ icon: Icon, title, desc }, i) => (
                <button
                  key={title}
                  onClick={() => handleActionClick(i)}
                  disabled={loading || !context}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${design.gradientFrom}33, ${design.gradientTo}22)` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: design.gradientFrom }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium tracking-tight">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>

        {!aiResponse && !context && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Gå til Kuvert eller Udgifter for at aktivere personlige indsigter.
              </p>
            </div>
          </div>
        )}

        <div className="h-safe-bottom" />
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 640px) {
          @keyframes slideUp {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        }
      `}</style>
    </div>
  );
}

export function AiAssistantButton({ context }: { context?: AiContext }) {
  const [open, setOpen] = useState(false);
  const { design } = useSettings();
  const { isAiActive } = useAiContext();

  if (!isAiActive) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[80px] right-4 md:bottom-6 md:right-6 z-50 group"
        style={{ bottom: 'max(88px, calc(64px + env(safe-area-inset-bottom, 0px) + 28px))' }}
        aria-label="Åbn Kuvert AI"
      >
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})` }}
        >
          {design.logoUrl ? (
            <img src={design.logoUrl} alt="Kuvert" className="object-contain" style={{ width: 52, height: 52 }} />
          ) : (
            <Sparkles className="h-7 w-7 text-white" />
          )}
        </div>
        <span
          className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full flex items-center justify-center text-white shadow-sm"
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})`,
            border: '2px solid white',
          }}
        >
          AI
        </span>
      </button>

      {open && <AiModal onClose={() => setOpen(false)} context={context} />}
    </>
  );
}

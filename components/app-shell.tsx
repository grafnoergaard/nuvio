'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import { SidebarLayout } from './sidebar-layout';
import { AuthGuard } from './auth-guard';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckupWizard } from '@/components/checkup-wizard';
import { Button } from './ui/button';
import { X, Activity } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import {
  loadTriggerSettings,
  loadUserState,
  upsertUserState,
  evaluateTrigger,
  type TriggerResult,
  type CheckupUserState,
  type NudgeLevel,
} from '@/lib/checkup-trigger';
import { AiAssistantButton } from '@/components/ai-assistant-button';
import { AiContextProvider, useAiContext } from '@/lib/ai-context';
import { useGlobalModalThemeColor } from '@/lib/use-modal-theme-color';

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function AppIcon({ className }: { className?: string }) {
  const { design } = useSettings();
  if (design.mobileNavIconUrl) {
    return (
      <div className={`rounded-2xl overflow-hidden shadow-sm shrink-0 ${className ?? 'h-11 w-11'}`}>
        <img src={design.mobileNavIconUrl} alt="Ikon" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${className ?? 'h-11 w-11'}`}
      style={{ background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})` }}
    >
      <Activity className="h-5 w-5 text-white" />
    </div>
  );
}

function CheckupBanner({ level, onStart, onDismiss, onSnooze, onHardSnooze, allowSnooze, hardSnoozeDays }: {
  level: NudgeLevel;
  onStart: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onHardSnooze: () => void;
  allowSnooze: boolean;
  hardSnoozeDays: number;
}) {
  const { design } = useSettings();
  const isStrong = level === 'STRONG' || level === 'REACTIVATE';
  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md"
      style={{ animation: 'slideUp 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
    >
      <div className={`rounded-2xl shadow-xl border overflow-hidden ${isStrong ? 'border-amber-200 bg-amber-50' : 'bg-card border-border'}`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <AppIcon className="h-9 w-9" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {level === 'REACTIVATE' ? 'Din plan trænger til et tjek' : 'Hurtigt finansielt tjek?'}
            </p>
            <p className="text-xs text-muted-foreground">Det tager kun 1 minut</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-8 rounded-xl text-xs px-3"
              onClick={onStart}
              style={{ background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})` }}
            >
              Start
            </Button>
            {allowSnooze ? (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {allowSnooze && (
          <div className="flex border-t border-border/50 divide-x divide-border/50">
            <button
              onClick={onSnooze}
              className="flex-1 py-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              Senere
            </button>
            <button
              onClick={onHardSnooze}
              className="flex-1 py-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              Skjul i {hardSnoozeDays} dage
            </button>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function CheckupModal({ level, onStart, onDismiss, onSnooze, onHardSnooze, allowSnooze, hardSnoozeDays }: {
  level: NudgeLevel;
  onStart: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onHardSnooze: () => void;
  allowSnooze: boolean;
  hardSnoozeDays: number;
}) {
  const { design } = useSettings();
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden mx-4"
        style={{ animation: 'slideUp 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <AppIcon />
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-lg font-bold tracking-tight mb-1">
            {level === 'REACTIVATE' ? 'Din finansielle plan er forældet' : 'Vil du tage et hurtigt økonomisk tjek?'}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            {level === 'REACTIVATE'
              ? 'Det er over 90 dage siden din plan sidst blev opdateret. Opdatér den på 90 sekunder.'
              : 'Det er over 60 dage siden din plan sidst blev opdateret. Det tager kun 1 minut.'}
          </p>

          <div className="flex gap-3">
            <Button
              className="flex-1 rounded-2xl h-11"
              onClick={onStart}
              style={{ background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})` }}
            >
              {level === 'REACTIVATE' ? 'Opdatér min plan' : 'Start tjek'}
            </Button>
            <Button
              variant="ghost"
              className="rounded-2xl h-11 text-muted-foreground"
              onClick={onDismiss}
            >
              Ikke nu
            </Button>
          </div>
        </div>
        {allowSnooze && (
          <div className="flex border-t border-border divide-x divide-border">
            <button
              onClick={onSnooze}
              className="flex-1 py-3 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              Senere
            </button>
            <button
              onClick={onHardSnooze}
              className="flex-1 py-3 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              Skjul i {hardSnoozeDays} dage
            </button>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function CheckupController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setWizardActive } = useAiContext();
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [lastCheckupAt, setLastCheckupAt] = useState<string | null>(null);
  const [checkupCount, setCheckupCount] = useState(0);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [userState, setUserState] = useState<CheckupUserState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const evaluatedOnceRef = useRef(false);
  const inFlightRef = useRef<AbortController | null>(null);
  const triggerResultRef = useRef<TriggerResult | null>(null);
  const budgetIdRef = useRef<string | null>(null);

  triggerResultRef.current = triggerResult;
  budgetIdRef.current = budgetId;

  useEffect(() => {
    setWizardActive(showWizard);
  }, [showWizard, setWizardActive]);

  useEffect(() => {
    if (evaluatedOnceRef.current) return;
    if (pathname === '/login' || pathname === '/checkup') return;
    evaluatedOnceRef.current = true;
    evaluate();
    return () => {
      inFlightRef.current?.abort();
    };
  }, [pathname]);

  useEffect(() => {
    async function handleForce(e: Event) {
      const variant = (e as CustomEvent).detail?.variant as string | undefined;
      if (variant === 'wizard') {
        setShowModal(false);
        setShowBanner(false);
        if (!budgetIdRef.current) {
          const { data: b } = await supabase
            .from('budgets')
            .select('id, last_checkup_at, checkup_count')
            .eq('is_active', true)
            .maybeSingle();
          const budget = b ?? await supabase
            .from('budgets')
            .select('id, last_checkup_at, checkup_count')
            .order('year', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(r => r.data);
          if (budget) {
            setBudgetId(budget.id);
            setLastCheckupAt(budget.last_checkup_at ?? null);
            setCheckupCount(budget.checkup_count ?? 0);
          }
        }
        setShowWizard(true);
      } else if (variant === 'modal') {
        setShowWizard(false);
        setShowBanner(false);
        if (!triggerResultRef.current) {
          setTriggerResult({
            level: 'STRONG',
            showModal: true,
            showBanner: false,
            showBadge: false,
            variant: 'STANDARD',
            snoozeDays: 7,
            hardSnoozeDays: 30,
            allowSnooze: true,
          });
        }
        setShowModal(true);
      } else if (variant === 'banner') {
        setShowWizard(false);
        setShowModal(false);
        if (!triggerResultRef.current) {
          setTriggerResult({
            level: 'SOFT',
            showModal: false,
            showBanner: true,
            showBadge: false,
            variant: 'QUICK',
            snoozeDays: 7,
            hardSnoozeDays: 30,
            allowSnooze: true,
          });
        }
        setShowBanner(true);
      }
    }
    window.addEventListener('nuvio:force-checkup', handleForce);
    return () => window.removeEventListener('nuvio:force-checkup', handleForce);
  }, []);

  async function evaluate() {
    if (inFlightRef.current) {
      inFlightRef.current.abort();
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    try {
      const [settingsResult, budgetResult, { data: { user } }] = await Promise.all([
        loadTriggerSettings(),
        supabase
          .from('budgets')
          .select('id, last_checkup_at, checkup_count, onboarding_state, updated_at')
          .eq('is_active', true)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);

      if (controller.signal.aborted) return;

      let budget: any = budgetResult.data;
      if (!budget) {
        const { data: fb } = await supabase
          .from('budgets')
          .select('id, last_checkup_at, checkup_count, onboarding_state, updated_at')
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle();
        budget = fb;
      }

      if (controller.signal.aborted) return;
      if (!budget || !user) return;

      setBudgetId(budget.id);
      setLastCheckupAt(budget.last_checkup_at ?? null);
      setCheckupCount(budget.checkup_count ?? 0);

      const state = await loadUserState(budget.id, user.id);

      if (controller.signal.aborted) return;

      setUserState(state);

      const onboardingComplete = budget.onboarding_state === 'complete' || budget.onboarding_state == null;
      const daysSinceUpdate = daysSince(budget.updated_at ?? budget.last_checkup_at);
      const completionScore = computeCompletionScore(budget);

      const result = evaluateTrigger({
        settings: settingsResult,
        userState: state,
        daysSinceUpdate,
        completionScore,
        onboardingComplete,
        lastLoginAt: new Date().toISOString(),
        sessionsLast30d: 3,
      });

      if (controller.signal.aborted) return;

      setTriggerResult(result);

      if (result.level !== 'NONE') {
        const timerId = setTimeout(() => {
          if (controller.signal.aborted) return;
          if (result.showModal) {
            setShowModal(true);
          } else if (result.showBanner) {
            setShowBanner(true);
          }
        }, 1500);
        controller.signal.addEventListener('abort', () => clearTimeout(timerId));
      }
    } catch {
    } finally {
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
    }
  }

  function computeCompletionScore(budget: any): number {
    if (!budget) return 0;
    let score = 0;
    if (budget.onboarding_state === 'complete') score += 100;
    else score += 50;
    return score;
  }

  async function recordImpression(type: 'modal' | 'banner') {
    if (!budgetId || !userState) return;
    const now = new Date().toISOString();
    const patch: Partial<CheckupUserState> = {
      last_prompted_at: now,
      impressions_7d: (userState.impressions_7d ?? 0) + 1,
    };
    if (type === 'modal') patch.last_modal_shown_at = now;
    if (type === 'banner') patch.last_banner_shown_at = now;
    await upsertUserState({ ...patch, budget_id: budgetId, user_id: userState.user_id });
  }

  async function handleSnooze(hard = false) {
    if (!budgetId || !triggerResult) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const days = hard ? triggerResult.hardSnoozeDays : triggerResult.snoozeDays;
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await upsertUserState({ budget_id: budgetId, user_id: user.id, snoozed_until: until });
    setShowModal(false);
    setShowBanner(false);
  }

  async function handleStart() {
    setShowModal(false);
    setShowBanner(false);
    setShowWizard(true);
    if (budgetId && userState) {
      await recordImpression('modal');
    }
  }

  async function handleDismiss() {
    setShowModal(false);
    setShowBanner(false);
  }

  return (
    <>
      {children}
      {showBanner && !showModal && !showWizard && triggerResult && (
        <CheckupBanner
          level={triggerResult.level}
          onStart={handleStart}
          onDismiss={handleDismiss}
          onSnooze={() => handleSnooze(false)}
          onHardSnooze={() => handleSnooze(true)}
          allowSnooze={triggerResult.allowSnooze}
          hardSnoozeDays={triggerResult.hardSnoozeDays}
        />
      )}
      {showModal && !showWizard && triggerResult && (
        <CheckupModal
          level={triggerResult.level}
          onStart={handleStart}
          onDismiss={handleDismiss}
          onSnooze={() => handleSnooze(false)}
          onHardSnooze={() => handleSnooze(true)}
          allowSnooze={triggerResult.allowSnooze}
          hardSnoozeDays={triggerResult.hardSnoozeDays}
        />
      )}
      {showWizard && budgetId && (
        <CheckupWizard
          budgetId={budgetId}
          lastCheckupAt={lastCheckupAt}
          checkupCount={checkupCount}
          onComplete={() => setShowWizard(false)}
          onDismiss={() => setShowWizard(false)}
        />
      )}
    </>
  );
}

function AiAssistantButtonWithContext() {
  const { aiContext, wizardActive } = useAiContext();
  if (wizardActive) return null;
  return <AiAssistantButton context={aiContext} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  useGlobalModalThemeColor();

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <AuthGuard>{children}</AuthGuard>;
  }


  return (
    <AuthGuard>
      {!loading && user ? (
        <AiContextProvider>
          <SidebarLayout>
            <CheckupController>
              {children}
            </CheckupController>
            <AiAssistantButtonWithContext />
          </SidebarLayout>
        </AiContextProvider>
      ) : null}
    </AuthGuard>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useAiContext } from '@/lib/ai-context';
import { ArrowRight, Check, Shield } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { toast } from 'sonner';

const TOTAL_STEPS = 5;

interface StepConfig {
  label: string;
  gradient: string;
}

const STEP_CONFIGS: StepConfig[] = [
  { label: 'Nuvios rådgiverløfte', gradient: 'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)' },
  { label: 'Hvad Nuvio er', gradient: 'linear-gradient(to bottom, #ecfdf5, #ffffff, #f0fdfa)' },
  { label: 'Vores styrke', gradient: 'linear-gradient(to bottom, #f0fdfa, #ecfdf5, #ffffff)' },
  { label: 'Præcision kræver ærlighed', gradient: 'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)' },
  { label: 'Dit system', gradient: 'linear-gradient(to bottom, #f0fdfa, #ecfdf5, #ffffff)' },
];


export function WhyWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = 'rgb(236,253,245)';
    document.body.style.backgroundColor = color;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    return () => {
      document.body.style.backgroundColor = '';
      if (meta) meta.content = '#ffffff';
    };
  }, []);

  function next() {
    animate('forward', () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)));
  }

  function back() {
    animate('back', () => setStep(s => Math.max(s - 1, 0)));
  }

  async function handleActivate() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_precision_commitment')
        .upsert(
          { user_id: user.id, accepted_at: new Date().toISOString(), version: 'v1', precision_mode: true },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      setDone(true);
      animate('forward', () => setStep(4));
    } catch (err) {
      console.error('WhyWizard activation error:', err);
      toast.error('Noget gik galt. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  const cfg = STEP_CONFIGS[Math.min(step, STEP_CONFIGS.length - 1)];
  const showBack = step > 0 && step < 4 && !done;
  const showSkip = step === 0;


  return (
    <WizardShell
      gradient={cfg.gradient}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      isDone={done}
      showBack={showBack}
      showClose={showSkip}
      onBack={back}
      onClose={onComplete}
      animating={animating}
      direction={direction}
    >
      {/* Step label */}
      <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
        {cfg.label}
      </p>

      {/* Step 0 */}
      {step === 0 && (
        <div className="space-y-5 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-foreground">
            Du er i gang.
          </h1>
          <p className="text-foreground/70 text-lg leading-relaxed">
            Men før vi rådgiver dig, skal vi lige være enige om&nbsp;
            <span className="text-foreground font-semibold">én ting.</span>
          </p>
          <div className="pt-4">
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-emerald-200 pl-4">
              Det tager under et minut. Det gør vores rådgivning markant mere præcis.
            </p>
          </div>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-5 flex-1 flex flex-col justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Nuvio er ikke magi.
          </h2>
          <div className="space-y-3 text-foreground/65 text-lg leading-relaxed pt-2">
            <p>Vi trækker ikke data fra din bank.</p>
            <p>Vi overvåger dig ikke.</p>
            <p>Vi gætter ikke.</p>
          </div>
          <div className="h-px bg-foreground/8 my-2" />
          <p className="text-foreground text-base font-medium leading-relaxed">
            Det betyder én ting:
          </p>
          <p className="text-foreground/60 text-base leading-relaxed">
            Vi bygger kun på det, du selv fortæller.
          </p>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-5 flex-1 flex flex-col justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Det gør os stærkere.
          </h2>
          <div className="space-y-2 text-foreground/65 text-lg leading-relaxed pt-2">
            <p>Banker bruger gennemsnit.</p>
            <p>Standardtal.</p>
            <p>Antagelser.</p>
          </div>
          <p className="text-foreground text-2xl font-semibold pt-1">
            Nuvio bruger dig.
          </p>
          <div className="bg-white/60 backdrop-blur border border-white/40 rounded-2xl px-5 py-4 mt-2">
            <p className="text-sm text-foreground leading-relaxed font-medium">
              Hvis du er præcis — er vi mere præcise end banken.
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Jo ærligere du er, jo bedre rådgiver bliver Nuvio.
            </p>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-5 flex-1 flex flex-col justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Præcision kræver ærlighed.
          </h2>
          <div className="space-y-2 text-foreground/65 text-lg leading-relaxed pt-2">
            <p>Hvis du runder op.</p>
            <p>Hvis du glemmer udgifter.</p>
            <p>Hvis du pynter på tallene.</p>
          </div>
          <div className="h-px bg-foreground/8" />
          <p className="text-foreground text-base leading-relaxed font-medium">
            Så rådgiver vi forkert.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ikke fordi vi ikke kan. Men fordi vi ikke må gætte.
          </p>

          <button
            onClick={() => setAccepted(a => !a)}
            className={`w-full flex items-start gap-3 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 mt-2 ${
              accepted
                ? 'border-emerald-500 bg-emerald-50/60'
                : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
            }`}
          >
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
              accepted ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/25'
            }`}>
              {accepted && <Check className="h-3 w-3 text-white stroke-[3]" />}
            </div>
            <p className="text-sm font-medium text-foreground leading-snug">
              Jeg forstår at Nuvios præcision afhænger af mine indtastninger.
            </p>
          </button>
        </div>
      )}

      {/* Step 4A */}
      {step === 4 && !done && (
        <div className="space-y-5 flex-1 flex flex-col justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Det er dit system.
          </h2>
          <div className="space-y-3 text-foreground/65 text-lg leading-relaxed pt-2">
            <p>Nuvio er ikke en bank.</p>
            <p>Nuvio er dit spejl.</p>
          </div>
          <p className="text-foreground text-base font-medium leading-relaxed">
            Vi viser det billede, du tegner.
          </p>
          <div className="flex items-start gap-3 bg-white/50 backdrop-blur border border-white/40 rounded-2xl px-5 py-4 mt-2">
            <Shield className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vi ændrer aldrig dine tal.
            </p>
          </div>
        </div>
      )}

      {/* Step 4B — Done */}
      {step === 4 && done && (
        <div className="space-y-5 flex-1 flex flex-col justify-center pb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200 mb-2">
            <Check className="h-8 w-8 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Præcision aktiveret.
          </h2>
          <p className="text-foreground/65 text-lg leading-relaxed">
            Nu rådgiver Nuvio på dine præmisser.
          </p>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="pt-6">
        {(step === 0 || step === 1 || step === 2) && (
          <button
            onClick={next}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {step === 0 ? 'Fortæl mig mere' : 'Fortsæt'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {step === 3 && (
          <button
            onClick={next}
            disabled={!accepted}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            Fortsæt
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {step === 4 && !done && (
          <button
            onClick={handleActivate}
            disabled={saving}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {saving ? 'Aktiverer...' : 'Aktivér præcis rådgivning'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        )}

        {step === 4 && done && (
          <button
            onClick={onComplete}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            Gå til overblik
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </WizardShell>
  );
}

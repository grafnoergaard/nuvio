'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, CalendarDays, TrendingUp, Gauge, Receipt, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NuvioFlowGuideModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const SLIDES = [
  {
    icon: <TrendingUp className="h-8 w-8 text-emerald-600" />,
    tag: 'Kuvert',
    title: 'Din digitale kuvert til hverdagen',
    body: 'Se præcis hvad du har til rådighed. Ikke sidst på måneden, men lige nu. Når der er penge i kuverten, kan du bruge dem med ro i maven.',
    visual: (
      <div className="mt-5 rounded-2xl bg-white/70 border border-emerald-100 px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground/60 font-medium">Tilbage denne måned</p>
          <p className="text-2xl font-bold text-emerald-700">4.454 kr.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground/60 font-medium">Per dag</p>
          <p className="text-lg font-semibold">636 kr.</p>
        </div>
      </div>
    ),
  },
  {
    icon: <Sparkles className="h-8 w-8 text-emerald-600" />,
    tag: 'Daglig værdi',
    title: 'Du ved altid, hvad kuverten rummer',
    body: 'Ingen ubehagelige overraskelser sidst på måneden. Et hurtigt tjek om dagen gør dine valg lettere.',
    visual: (
      <div className="mt-5 space-y-2.5">
        {[
          { label: 'Bevidsthed', desc: 'Du ved altid, hvad du har til rådighed' },
          { label: 'Kontrol', desc: 'Du bruger kun det, der ligger i kuverten' },
          { label: 'Ro', desc: 'Du kan bruge penge uden dårlig samvittighed' },
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-xl bg-white/70 border border-emerald-100 px-3 py-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="text-xs text-muted-foreground/60">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <Receipt className="h-8 w-8 text-emerald-600" />,
    tag: 'Hurtig handling',
    title: 'Læg hver udgift i kuverten',
    body: 'Indtast beløbet og gem. Så opdateres dit beløb til rådighed med det samme, og din Score følger automatisk med.',
    visual: (
      <div className="mt-5 space-y-3">
        <div className="rounded-2xl bg-white/70 border border-emerald-100 px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">+</span>
          </div>
          <div>
            <p className="text-sm font-semibold">Tilføj udgift</p>
            <p className="text-xs text-muted-foreground/60">Beløb · Beskrivelse · Gem</p>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground/50 px-2">
          Jo mere præcist du registrerer, jo mere præcis er din score
        </p>
      </div>
    ),
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-emerald-600" />,
    tag: 'Den vigtigste regel',
    title: 'Notér det, når du bruger penge',
    body: 'Ikke senere. Ikke "når du husker det". Lige når du betaler. Så ved du altid, hvor meget der er tilbage i kuverten.',
    visual: (
      <div className="mt-5 space-y-2.5">
        {[
          { label: 'Ved kassen', desc: 'Dagligvarer, kaffe, take-away — notér det med det samme' },
          { label: 'Online køb', desc: 'Også de små og dem du måske fortryder' },
          { label: 'Kontanter', desc: 'Tæller stadig — noter hævningen med det samme' },
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-xl bg-white/70 border border-emerald-100 px-3 py-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="text-xs text-muted-foreground/60">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <CalendarDays className="h-8 w-8 text-emerald-600" />,
    tag: 'Kuvert',
    title: 'Din måned — delt op for dig',
    body: 'Din kuvert deles automatisk op i uger. Bruger du mere én uge, justeres resten, så du stadig kan se, hvad du har til rådighed.',
    visual: (
      <div className="mt-5 space-y-2">
        {[
          { label: 'Uge 1', pct: 40, color: 'bg-emerald-400', status: 'Under budget' },
          { label: 'Uge 2', pct: 95, color: 'bg-amber-400', status: 'Tæt på grænsen' },
          { label: 'Uge 3', pct: 60, color: 'bg-emerald-400', status: 'Under budget' },
        ].map((w) => (
          <div key={w.label} className="flex items-center gap-3">
            <p className="text-xs font-medium text-muted-foreground/60 w-10 shrink-0">{w.label}</p>
            <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
              <div className={cn('h-full rounded-full', w.color)} style={{ width: `${w.pct}%` }} />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground/50 pt-1">Grøn = under budget · Gul = tæt på grænsen</p>
      </div>
    ),
  },
  {
    icon: <Gauge className="h-8 w-8 text-emerald-600" />,
    tag: 'Din Score',
    title: 'Se om du er på rette vej',
    body: 'Din score viser, hvor godt du holder dig inden for dit budget. Jo tættere du følger din plan, jo stærkere står din økonomi.',
    visual: (
      <div className="mt-5 rounded-2xl bg-white/70 border border-emerald-100 px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground/60">Din Score</p>
          <p className="text-sm font-bold text-emerald-700">87</p>
        </div>
        <div className="h-2 rounded-full bg-black/5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: '87%' }} />
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-xs text-muted-foreground/50">Under budget</p>
          <p className="text-xs font-semibold text-emerald-600">Din Score er stærk ved 80+</p>
        </div>
      </div>
    ),
  },
  {
    icon: <TrendingUp className="h-8 w-8 text-emerald-600" />,
    tag: 'Kom i gang',
    title: 'Klar til at åbne din kuvert?',
    body: 'Det tager under 30 sekunder at komme i gang. Du kan justere alt undervejs - start bare.',
    visual: (
      <div className="mt-5 space-y-2.5">
        {[
          { label: 'Trin 1', desc: 'Indtast hvad du vil have til rådighed' },
          { label: 'Trin 2', desc: 'Registrér din første udgift, næste gang du handler' },
          { label: 'Trin 3', desc: 'Tjek din Score og hold kuverten grøn' },
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-xl bg-white/70 border border-emerald-100 px-3 py-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="text-xs text-muted-foreground/60">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

const TOTAL = SLIDES.length;

export default function NuvioFlowGuideModal({ open, onClose, onComplete }: NuvioFlowGuideModalProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  useEffect(() => {
    if (open) {
      setStep(0);
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  function go(dir: 'forward' | 'back') {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => (dir === 'forward' ? s + 1 : s - 1));
      setAnimating(false);
    }, 180);
  }

  if (!open) return null;

  const slide = SLIDES[step];
  const isLast = step === TOTAL - 1;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex items-center justify-center transition-all duration-300 px-4',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          'relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300',
          visible ? 'translate-y-0' : 'translate-y-8'
        )}
        style={{ maxHeight: '90dvh' }}
      >
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-700"
          style={{ background: 'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)' }}
        />

        <div className="relative px-6 pt-6 pb-safe overflow-y-auto" style={{ maxHeight: '90dvh' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1.5">
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === step ? 'w-6 bg-emerald-500' : 'w-1.5 bg-emerald-200'
                  )}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full border border-black/10 bg-white/60 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="transition-all duration-[180ms]"
            style={{
              opacity: animating ? 0 : 1,
              transform: animating
                ? `translateX(${direction === 'forward' ? '12px' : '-12px'})`
                : 'translateX(0)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                {slide.icon}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70">
                  {slide.tag}
                </p>
                <h2 className="text-xl font-bold leading-tight tracking-tight">
                  {slide.title}
                </h2>
              </div>
            </div>

            <p className="text-sm text-foreground/70 leading-relaxed">
              {slide.body}
            </p>

            {slide.visual}
          </div>

          <div className="flex items-center justify-between mt-8 mb-6">
            <button
              onClick={() => go('back')}
              className={cn(
                'h-11 w-11 rounded-2xl border-2 border-black/10 bg-white/60 flex items-center justify-center transition-all',
                step === 0 ? 'opacity-0 pointer-events-none' : 'hover:border-black/20'
              )}
            >
              <ChevronLeft className="h-5 w-5 text-foreground/60" />
            </button>

            {isLast ? (
              <button
                onClick={onComplete ?? onClose}
                className="h-11 px-8 rounded-2xl font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Kom i gang
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => go('forward')}
                className="h-11 px-8 rounded-2xl font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Fortsæt
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

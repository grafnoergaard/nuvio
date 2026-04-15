'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mail, Eye, EyeOff, ArrowRight, Loader as Loader2, CircleCheck as CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import NuvioFlowGuideModal from '@/components/nuvio-flow-guide-modal';

type Mode = 'login' | 'register' | 'verify' | 'intro';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setVerified(true);
      router.replace('/login');
    }
  }, [searchParams, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login?verified=true`,
          },
        });
        if (error) throw error;
        setMode('verify');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ukendt fejl';
      if (msg.includes('Invalid login credentials')) {
        setError('Forkert email eller adgangskode.');
      } else if (msg.includes('User already registered')) {
        setError('Denne email er allerede oprettet. Prøv at logge ind.');
      } else if (msg.includes('Password should be at least')) {
        setError('Adgangskoden skal være mindst 6 tegn.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSocial(provider: 'google' | 'facebook' | 'apple') {
    setSocialLoading(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setError(error.message);
      setSocialLoading(null);
    }
  }

  if (mode === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Bekræft din email</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Vi har sendt et bekræftelses-link til <strong className="text-foreground">{email}</strong>.
            Tjek din indbakke og klik på linket for at aktivere din konto.
          </p>
          <button
            onClick={() => setMode('login')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Tilbage til login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background relative">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-stone-900 to-stone-800 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(16,185,129,0.08),transparent_60%)]" />
        <div className="relative z-10 text-white max-w-md">
          <div className="mb-10">
            <Image src="/kuvert-icon.png" alt="Kuvert" width={120} height={120} className="h-20 w-20 rounded-3xl object-contain shadow-lg" />
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Din økonomi i en enkel kuvert.
          </h2>
          <p className="text-stone-400 text-lg leading-relaxed">
            Kuvert viser dig, hvad du har til rådighed lige nu. Når der er penge i kuverten, kan du bruge dem med ro i maven.
          </p>
          <div className="mt-12 space-y-4">
            {[
              'Se dit beløb til rådighed uden at regne',
              'Registrér udgifter på få sekunder',
              'Hold din uge og måned inden for budget',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <span className="text-stone-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <Image src="/kuvert-icon.png" alt="Kuvert" width={64} height={64} className="h-16 w-16 rounded-2xl object-contain shadow-md" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? 'Velkommen tilbage' : 'Opret konto'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === 'login'
                ? 'Log ind og se hvad du har til rådighed'
                : 'Kom i gang med Kuvert i dag'}
            </p>
          </div>

          {verified && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3 flex items-start gap-3 mb-6">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Din email er bekræftet. Du kan nu logge ind.
              </p>
            </div>
          )}

          <div className="space-y-2.5 mb-6">
            <button
              disabled
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card text-sm font-medium opacity-40 cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Fortsæt med Google
            </button>

            <button
              disabled
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card text-sm font-medium opacity-40 cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Fortsæt med Facebook
            </button>

            <button
              disabled
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card text-sm font-medium opacity-40 cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/>
              </svg>
              Fortsæt med Apple
            </button>
          </div>

          <div className="relative mb-6">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
              eller med email
            </span>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@email.dk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Adgangskode</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Mindst 6 tegn' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 px-4 py-3">
                <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {mode === 'login' ? 'Log ind' : 'Opret konto'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'login' ? (
              <>
                Har du ikke en konto?{' '}
                <button
                  onClick={() => { setMode('intro'); setError(null); }}
                  className="font-semibold text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  Opret gratis
                </button>
              </>
            ) : mode === 'register' ? (
              <>
                Har du allerede en konto?{' '}
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className="font-semibold text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  Log ind
                </button>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <NuvioFlowGuideModal
        open={mode === 'intro'}
        onClose={() => { setMode('login'); setError(null); }}
        onComplete={() => setMode('register')}
      />
    </div>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

type Step = 'email' | 'code';

const RESEND_COOLDOWN_SEC = 30;

function safeNext(raw: string | null): string {
  // Honor only relative paths to avoid open-redirect via ?next=.
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/dashboard';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const nextPath = safeNext(searchParams.get('next'));

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // If the user is already authenticated, don't show the form — just
  // bounce to their destination. Avoids the subtle bug where a logged-in
  // user clicks "Sign In" and lands on a form that claims they're not
  // signed in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath);
    });
    // Only run once on mount; the instance is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autofocus the code field when step flips.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendCode = useCallback(
    async (target: string) => {
      setError(null);
      setInfo(null);
      setLoading(true);
      try {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: target,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (otpError) {
          setError(otpError.message);
          return false;
        }
        setInfo(`We sent a 6-digit code to ${target}.`);
        setResendCooldown(RESEND_COOLDOWN_SEC);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unexpected error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [supabase, nextPath]
  );

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await sendCode(email.trim());
    if (ok) setStep('code');
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, '').trim();
    if (token.length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message);
        setLoading(false);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await sendCode(email);
  };

  const backToEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setInfo(null);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          {step === 'email' ? 'Sign in to Survai' : 'Enter your code'}
        </CardTitle>
        <CardDescription>
          {step === 'email'
            ? 'We\u2019ll email you a 6-digit code. No password needed.'
            : `We sent a code to ${email}. It expires in 10 minutes.`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === 'email' && (
          <>
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 my-6">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}

              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send code
              </Button>
            </form>
          </>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
                disabled={loading}
                className="tracking-[0.5em] text-center text-lg font-mono"
              />
            </div>

            {info && <div className="text-sm text-muted-foreground">{info}</div>}
            {error && <div className="text-sm text-destructive">{error}</div>}

            <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & continue
            </Button>

            <div className="flex items-center justify-between pt-2 text-sm">
              <button
                type="button"
                onClick={backToEmail}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Use a different email
              </button>
              <button
                type="button"
                onClick={handleResend}
                className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </CardContent>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

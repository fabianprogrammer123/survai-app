import { redirect } from 'next/navigation';

/**
 * /signup is retained as a compatibility redirect. Survai is
 * passwordless: signInWithOtp auto-creates the account on first use,
 * so "sign up" and "sign in" are the same page — /login. We keep the
 * route so old inbound links and any cached OAuth redirect URLs still
 * resolve.
 */
export default function SignupPage() {
  redirect('/login');
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

function GoogleButton({ next }: { next: string }) {
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continue with Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200" />
        or
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
    </>
  );
}

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Sign in to your agency workspace.</p>
      {googleEnabled ? <GoogleButton next={next} /> : null}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          const { error } = await authClient.signIn.email({
            email: String(fd.get("email")),
            password: String(fd.get("password")),
          });
          setPending(false);
          if (error) return setError(error.message ?? "Could not sign in");
          router.push(next);
          router.refresh();
        }}
      >
        <FormError message={error} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={params.get("email") ?? ""} />
        </Field>
        <Field
          label={
            <span className="flex justify-between">
              Password
              <Link href="/forgot-password" className="font-normal text-brand-600 hover:underline">
                Forgot?
              </Link>
            </span>
          }
          htmlFor="password"
        >
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link href={`/sign-up${params.toString() ? `?${params}` : ""}`} className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Start collecting client approvals in minutes.</p>
      {googleEnabled ? <GoogleButton next={next} /> : null}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          const { error } = await authClient.signUp.email({
            name: String(fd.get("name")),
            email: String(fd.get("email")),
            password: String(fd.get("password")),
          });
          setPending(false);
          if (error) return setError(error.message ?? "Could not create account");
          router.push(next);
          router.refresh();
        }}
      >
        <FormError message={error} />
        <Field label="Full name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={params.get("email") ?? ""} />
        </Field>
        <Field label="Password" hint="At least 8 characters." htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href={`/sign-in${params.toString() ? `?${params}` : ""}`} className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent)
    return (
      <div>
        <h1 className="text-xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-zinc-500">If an account exists for that email, a reset link is on its way.</p>
        <Link href="/sign-in" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        const { error } = await authClient.requestPasswordReset({
          email: String(fd.get("email")),
          redirectTo: "/reset-password",
        });
        setPending(false);
        if (error) return setError(error.message ?? "Something went wrong");
        setSent(true);
      }}
    >
      <div>
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-zinc-500">We’ll email you a link to choose a new one.</p>
      </div>
      <FormError message={error} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "This link is invalid or expired." : null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!token) return setError("Missing reset token.");
        const fd = new FormData(e.currentTarget);
        setPending(true);
        const { error } = await authClient.resetPassword({ newPassword: String(fd.get("password")), token });
        setPending(false);
        if (error) return setError(error.message ?? "Could not reset password");
        router.push("/sign-in");
      }}
    >
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <FormError message={error} />
      <Field label="New password" hint="At least 8 characters." htmlFor="password">
        <Input id="password" name="password" type="password" minLength={8} required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}

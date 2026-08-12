import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, emailHasAccount, mockUserName } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Pocket Planner" },
      { name: "description", content: "Sign in or create your Pocket Planner budgeting account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72);

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.56-5.17 3.56-8.83Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l4.01 3.11C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="size-5" aria-hidden="true">
      <path fill="#F35325" d="M1 1h10v10H1z" />
      <path fill="#81BC06" d="M12 1h10v10H12z" />
      <path fill="#05A6F0" d="M1 12h10v10H1z" />
      <path fill="#FFBA08" d="M12 12h10v10H12z" />
    </svg>
  );
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

type Step = "email" | "password" | "signup" | "forgot" | "check-email";

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [checkEmailMode, setCheckEmailMode] = useState<"confirm" | "reset">("confirm");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    const value = parsed.data.toLowerCase();
    setEmail(value);
    const exists = emailHasAccount(value);
    if (exists) {
      setDisplayName(mockUserName(value) ?? "");
      setStep("password");
    } else if (exists === false) {
      setStep("signup");
    } else {
      setStep("password");
    }
  }

  async function handleSocial(provider: "google" | "azure") {
    setSocialLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    setSocialLoading(null);
    if (error) toast.error(error.message);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z
      .object({ email: emailSchema, password: passwordSchema })
      .safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      if (emailHasAccount(email) === false) setStep("signup");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z
      .object({ email: emailSchema, password: passwordSchema })
      .safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name.trim() },
      },
    });
    setLoading(false);
    if (error) {
      if (/already exists/i.test(error.message)) {
        setDisplayName(name.trim());
        setStep("password");
      }
      toast.error(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setCheckEmailMode("confirm");
    setStep("check-email");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCheckEmailMode("reset");
    setStep("check-email");
  }

  function backToEmail() {
    setPassword("");
    setDisplayName("");
    setStep("email");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="size-5" />
        </span>
        <span className="font-display text-lg font-semibold">Pocket Planner</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
        {step === "check-email" ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {checkEmailMode === "reset" ? (
                <>
                  We sent a password reset link to <strong>{email}</strong>. Click it to choose a
                  new password, then sign in.
                </>
              ) : (
                <>
                  We sent a confirmation link to <strong>{email}</strong>. Click it to activate
                  your account, then come back and sign in.
                </>
              )}
            </p>
            <Button className="mt-6 w-full" variant="outline" onClick={() => setStep("email")}>
              Back to sign in
            </Button>
          </div>
        ) : step === "forgot" ? (
          <div>
            <h1 className="text-xl font-semibold">Reset password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your account email and we'll send you a link to set a new password.
            </p>
            <form onSubmit={handleForgot} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setEmail("");
                }}
              >
                Back to sign in
              </Button>
            </form>
          </div>
        ) : step === "password" ? (
          <div>
            <button
              type="button"
              onClick={backToEmail}
              className="mb-4 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Use another account
            </button>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                {initialsOf(displayName || email)}
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight">
                {displayName ? `Welcome back, ${displayName.split(" ")[0]}` : "Sign in"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            </div>
            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setStep("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              No account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setStep("signup")}
              >
                Create one
              </button>
            </div>
          </div>
        ) : step === "signup" ? (
          <div>
            <button
              type="button"
              onClick={backToEmail}
              className="mb-4 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Use another account
            </button>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                {initialsOf(email)}
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight">Create your account</p>
              <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            </div>
            <form onSubmit={handleSignUp} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Arun Kumar"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-up">Password</Label>
                <Input
                  id="password-up"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setDisplayName(mockUserName(email) ?? "");
                  setStep("password");
                }}
              >
                Sign in
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your email to continue to Pocket Planner.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => handleSocial("google")}
                disabled={socialLoading !== null}
              >
                <GoogleIcon />
                {socialLoading === "google" ? "Connecting…" : "Google"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => handleSocial("azure")}
                disabled={socialLoading !== null}
              >
                <MicrosoftIcon />
                {socialLoading === "azure" ? "Connecting…" : "Microsoft"}
              </Button>
            </div>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with email
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking…" : "Continue"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm">
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setStep("forgot")}
              >
                Forgot password?
              </button>
            </p>
            <p className="mt-3 border-t pt-4 text-center text-sm text-muted-foreground">
              New to Pocket Planner?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setStep("signup")}
              >
                Create an account
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

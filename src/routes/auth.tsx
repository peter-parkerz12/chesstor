import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClayCard } from "@/components/ui/surfaces";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Chesstor" },
      { name: "description", content: "Sign in to sync your chess preferences, progress, and games across devices." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const eRes = emailSchema.safeParse(email);
      if (!eRes.success) { toast.error(eRes.error.issues[0].message); return; }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(eRes.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox for the reset link.");
        setMode("signin");
        return;
      }

      const pRes = passwordSchema.safeParse(password);
      if (!pRes.success) { toast.error(pRes.error.issues[0].message); return; }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: eRes.data,
          password: pRes.data,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || undefined },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. You're signed in.");
          navigate({ to: "/" });
        } else {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          setPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: eRes.data,
          password: pRes.data,
        });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-nav mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Sync your preferences and progress across devices."
            : mode === "forgot"
            ? "We'll email you a reset link."
            : "Sign in to sync your chess progress."}
        </p>
      </div>

      <ClayCard>
        {mode !== "forgot" && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={busy}
              onClick={onGoogle}
            >
              <GoogleIcon /> Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}

        <form onSubmit={onEmailSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grandmaster"
                maxLength={80}
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
              ? "Create account"
              : mode === "forgot"
              ? "Send reset link"
              : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 text-center text-xs text-muted-foreground">
          {mode === "signin" && (
            <>
              New here?{" "}
              <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          )}
          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
          {mode === "forgot" && (
            <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => setMode("signin")}>
              Back to sign in
            </button>
          )}
        </div>
      </ClayCard>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Prefer to stay a guest?{" "}
        <Link to="/" className="text-foreground underline-offset-2 hover:underline">
          Continue without an account
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5 17.6 35.5 12.5 30.4 12.5 24S17.6 12.5 24 12.5c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.7 18.9 12.5 24 12.5c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 34.6 26.7 35.5 24 35.5c-5.3 0-9.9-3.1-11.9-7.5l-6.5 5C8.9 39 15.9 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.7 4.7-4.9 6.1l6.2 5.2c-.4.4 6.9-5 6.9-15.3 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

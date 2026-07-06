import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Wachtwoord herstellen — HappyBeez" },
      { name: "description", content: "Stel een nieuw wachtwoord in voor je HappyBeez account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Wachtwoord moet minimaal 6 tekens zijn.");
      return;
    }
    if (password !== confirm) {
      toast.error("Wachtwoorden komen niet overeen.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Wachtwoord bijgewerkt — je bent nu ingelogd.");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
            Social Studio
          </span>
          <h1 className="font-heading font-bold text-ink text-4xl mt-2">HappyBeez</h1>
          <div className="mt-3 h-px bg-gold w-12 mx-auto" />
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Nieuw wachtwoord instellen</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {ready
              ? "Kies een nieuw wachtwoord voor je account."
              : "Bezig met verifiëren van de herstel-link…"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nieuw wachtwoord</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={!ready}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={!ready}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !ready}>
              {busy ? "Bezig…" : "Wachtwoord opslaan"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => navigate({ to: "/auth" })}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full text-center"
          >
            Terug naar inloggen
          </button>
        </div>
      </div>
    </div>
  );
}

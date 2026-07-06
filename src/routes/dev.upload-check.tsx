import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { verifyPhotoUploadRls } from "@/lib/image.functions";

export const Route = createFileRoute("/dev/upload-check")({
  head: () => ({
    meta: [
      { title: "Dev · Upload RLS check" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UploadCheckPage,
});

type StepResult = { step: string; ok: boolean; detail?: string };
type CheckResult = { ok: boolean; steps: StepResult[] };

function UploadCheckPage() {
  const { currentOrgId, isLoading } = useCurrentOrg();
  const runCheck = useServerFn(verifyPhotoUploadRls);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    if (!currentOrgId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = (await runCheck({
        data: { org_id: currentOrgId },
      })) as CheckResult;
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Upload RLS check (library_photos)
          </CardTitle>
          <CardDescription>
            Voert een gecontroleerde test uit die als ingelogde gebruiker een
            testrij invoegt in <code>library_photos</code> met het huidige{" "}
            <code>org_id</code>, verifieert dat RLS het toestaat, en de rij
            daarna direct opruimt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Actieve org:{" "}
            <code>{isLoading ? "…" : (currentOrgId ?? "geen")}</code>
          </div>
          <Button onClick={onRun} disabled={busy || !currentOrgId}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Check uitvoeren
          </Button>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  result.ok
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {result.ok
                    ? "Alle stappen geslaagd — RLS accepteert org-scoped uploads."
                    : "Check gefaald — zie stappen hieronder."}
                </span>
              </div>
              <ul className="divide-y rounded-md border">
                {result.steps.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 text-sm"
                  >
                    {s.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs">{s.step}</div>
                      {s.detail && (
                        <div className="mt-1 break-words text-muted-foreground">
                          {s.detail}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

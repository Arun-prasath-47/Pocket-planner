import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support & privacy — Pocket Planner" }] }),
  component: SupportPage,
});

function SupportPage() {
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function sendFeedback() {
    const clean = message.trim();
    if (clean.length < 10) return toast.error("Please provide at least 10 characters");
    setSending(true);
    const { error } = await supabase.functions.invoke("submit-feedback", { body: { category, message: clean } });
    setSending(false);
    if (error) return toast.error(error.message);
    setMessage("");
    toast.success("Feedback sent — thank you");
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation: "DELETE" } });
    if (error) { setDeleting(false); return toast.error(error.message); }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return <AppShell title="Support & privacy" subtitle="Send feedback or manage your account data">
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg font-semibold">Send feedback</h2>
        <p className="mt-1 text-sm text-muted-foreground">Report a bug, request a feature, or ask a privacy question.</p>
        <div className="mt-4 space-y-3">
          <div className="space-y-2"><Label htmlFor="feedback-category">Category</Label><select id="feedback-category" value={category} onChange={e=>setCategory(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="general">General</option><option value="bug">Bug report</option><option value="feature">Feature request</option><option value="privacy">Privacy</option></select></div>
          <div className="space-y-2"><Label htmlFor="feedback-message">Message</Label><textarea id="feedback-message" value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000} rows={6} className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Tell us what happened or what would make Pocket Planner better…" /></div>
          <Button onClick={sendFeedback} disabled={sending || message.trim().length < 10}>{sending ? "Sending…" : "Send feedback"}</Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use Settings to download an export. Review our <a className="text-primary underline" href="/privacy">Privacy Policy</a> and <a className="text-primary underline" href="/terms">Terms</a>.</p>
      </section>

      <section className="rounded-2xl border border-destructive/40 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg font-semibold text-destructive">Permanently delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">This deletes your login and associated household data. Download an export first. This cannot be undone.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Type DELETE to confirm" aria-label="Account deletion confirmation" /><Button variant="destructive" onClick={deleteAccount} disabled={deleting || confirmation!=="DELETE"}>{deleting ? "Deleting…" : "Delete permanently"}</Button></div>
      </section>
    </div>
  </AppShell>;
}

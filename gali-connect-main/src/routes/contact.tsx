import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Send, Loader2, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact Support — Vegamart" }] }),
  component: ContactPage,
});

function ContactPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!isAuthenticated) {
      toast.info("Please sign in to contact support.");
      navigate({ to: "/login", search: { redirect: "/contact" } });
      return;
    }

    setSending(true);
    const res = await api.post("/contact", { name, email, message });
    setSending(false);

    if (res.success) {
      setName("");
      setEmail("");
      setMessage("");
      toast.success(res.message || "Thank you! Your message has been sent to Vegamart Support.");
    } else {
      toast.error(res.error?.message || "Failed to send your message. Please try again.");
    }
  };

  const { data: publicSettingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<Record<string, any>>("/settings/public"),
    staleTime: 60_000,
  });
  const publicSettings: Record<string, any> =
    (publicSettingsRes?.data as any)?.data ?? (publicSettingsRes?.data as any) ?? {};

  const supportEmail = publicSettings["support.email"] || "vegamart.com@gmail.com";
  const supportPhone = publicSettings["support.phone"] || "8640017166";

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Contact Support" subtitle="We're here to help" />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Get in Touch</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Have questions about your order, vendor onboarding, or platform support? Send us a
              message and our team will get back to you within 30 minutes.
            </p>

            <div className="space-y-3 pt-2">
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 hover:border-emerald-500/50 transition-colors"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-primary shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Email Support
                  </div>
                  <div className="text-xs font-bold text-foreground">{supportEmail}</div>
                </div>
              </a>

              <a
                href={`tel:${supportPhone}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 hover:border-blue-500/50 transition-colors"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-700 shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Helpline
                  </div>
                  <div className="text-xs font-bold text-foreground">{supportPhone}</div>
                </div>
              </a>

              <div className="flex items-start gap-3 rounded-2xl border bg-card p-3.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Address / Headquarters
                  </div>
                  <div className="text-xs font-bold text-foreground leading-relaxed">
                    Ketan, Jhulkadam Road, Sakti
                    <br />
                    Sakti, Chhattisgarh – 495689
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form
            className="rounded-3xl border bg-card p-6 shadow-soft space-y-4"
            onSubmit={handleSubmit}
          >
            <h2 className="font-display text-base font-bold">Send Message</h2>

            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Your Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Email Address</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Message</div>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help you today?"
                className="w-full rounded-2xl bg-muted border p-3 text-sm outline-none resize-none"
              />
            </label>

            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs h-11 shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Send Message <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

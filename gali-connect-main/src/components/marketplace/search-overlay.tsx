import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  X,
  Mic,
  MicOff,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Store,
  ShoppingBasket,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product, Vendor, Category } from "@/types";

const TRENDING = [
  "Fresh Tomatoes",
  "Baby Spinach",
  "Masala Chai",
  "Fresh Vegetables",
  "Juice & Tea",
  "Fresh Fruits",
];

const RECENT_KEY = "lgv:recent-searches";

function useRecent() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(RECENT_KEY) : null;
      if (raw) setRecent(JSON.parse(raw));
    } catch (err) {
      void err;
    }
  }, []);
  const push = (q: string) => {
    const term = q.trim();
    if (!term) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((p) => p.toLowerCase() !== term.toLowerCase())].slice(
        0,
        8,
      );
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };
  const clear = () => {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch (err) {
      void err;
    }
  };
  const remove = (q: string) => {
    setRecent((prev) => {
      const next = prev.filter((p) => p !== q);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };
  return { recent, push, clear, remove };
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [pulse, setPulse] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { recent, push, clear, remove } = useRecent();

  const { data: pRes } = useQuery({ queryKey: ["products"], queryFn: () => api.get<Product[]>("/products") });
  const { data: vRes } = useQuery({ queryKey: ["vendors"], queryFn: () => api.get<Vendor[]>("/vendors") });
  const { data: cRes } = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });

  const products = pRes?.data || [];
  const vendors = vRes?.data || [];
  const categories = cRes?.data || [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-expect-error webkit
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setPulse((p) => p + 1), 120);
    return () => clearInterval(id);
  }, [listening]);

  const productSug = useMemo(() => {
    if (!debounced) return [];
    return products.filter((p) => p.name.toLowerCase().includes(debounced)).slice(0, 6);
  }, [debounced, products]);

  const vendorSug = useMemo(() => {
    if (!debounced) return [];
    return vendors
      .filter((v) => {
        const nameMatch = v.business_name?.toLowerCase().includes(debounced) || false;
        // Skip tags filtering since it's not a simple array in DB, unless parsed
        return nameMatch;
      })
      .slice(0, 4);
  }, [debounced, vendors]);

  const categorySug = useMemo(() => {
    if (!debounced) return [];
    return categories.filter((c) => c.name.toLowerCase().includes(debounced)).slice(0, 4);
  }, [debounced, categories]);

  const hasResults = productSug.length + vendorSug.length + categorySug.length > 0;

  const submit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    push(t);
    onClose();
    setQ("");
    navigate({ to: "/vendors" });
  };

  const startVoice = () => {
    if (!voiceSupported) {
      setListening(true);
      setTimeout(() => {
        setListening(false);
        setQ("Fresh tomatoes");
      }, 2200);
      return;
    }
    // @ts-expect-error webkit
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    setListening(true);
    rec.onresult = (e: {
      results: { length: number; [key: number]: { [key: number]: { transcript: string } } };
    }) => {
      const resultsArray = Array.from({ length: e.results.length }, (_, i) => e.results[i]);
      const t = resultsArray.map((r) => r[0]?.transcript || "").join(" ");
      setQ(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  if (!open) return null;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      {/* Sticky Search Header — matches app theme */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3 pt-safe">
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted tap-highlight-none md:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(q)}
              placeholder="Search chai, sabzi, samosa, vendors…"
              className="h-11 w-full rounded-full bg-muted pl-9 pr-20 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Clear"
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-background"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={startVoice}
                aria-label="Voice search"
                className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
                  listening
                    ? "bg-primary text-primary-foreground"
                    : "text-primary hover:bg-background"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
            {debounced && !hasResults && (
               <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
                 <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
               </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 md:px-4 py-4 space-y-6">
        {/* Voice listening state */}
        {listening && (
          <div className="rounded-3xl bg-emerald-50 p-8 text-center animate-fade-in">
            <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Mic className="h-8 w-8" />
              <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
            </div>
            <p className="mt-4 text-sm font-bold text-primary">Listening…</p>
            <div className="mt-3 flex items-end justify-center gap-1 h-8">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-primary transition-all duration-150"
                  style={{
                    height: `${8 + Math.abs(Math.sin((pulse + i) * 0.6)) * 24}px`,
                    opacity: 0.35 + Math.abs(Math.sin((pulse + i) * 0.6)) * 0.55,
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setListening(false)}
              className="mt-4 text-xs font-semibold text-primary underline underline-offset-4"
            >
              Tap to cancel
            </button>
          </div>
        )}

        {/* Empty / initial state */}
        {!listening && !debounced && (
          <>
            {recent.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Recent
                  </div>
                  <button
                    onClick={clear}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <div
                      key={r}
                      className="group inline-flex items-center gap-1 rounded-full border bg-card pl-3 pr-1 py-1 text-sm"
                    >
                      <button onClick={() => setQ(r)} className="inline-flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {r}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        aria-label={`Remove ${r}`}
                        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-primary" /> Trending near you
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((t, i) => (
                  <button
                    key={t}
                    onClick={() => submit(t)}
                    className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50 hover:bg-emerald-50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-primary text-[10px] font-bold tabular-nums">
                      {i + 1}
                    </span>
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Browse categories
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {categories.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => submit(c.name)}
                    className="rounded-2xl bg-card border p-3 text-left hover:border-primary/50 hover:bg-emerald-50 transition-colors"
                  >
                    <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-primary">
                      <ShoppingBasket className="h-4 w-4" />
                    </div>
                    <div className="text-[13px] font-semibold truncate">{c.name}</div>
                    {/* Categories backend model doesn't have a count yet, we skip it */}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Suggestions */}
        {!listening && debounced && (
          <div className="space-y-5">
            {categorySug.length > 0 && (
              <section>
                <div className="mb-2 px-1 text-sm font-semibold">Categories</div>
                <div className="flex flex-wrap gap-2">
                  {categorySug.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => submit(c.name)}
                      className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50 hover:bg-emerald-50 transition-colors"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {productSug.length > 0 && (
              <section>
                <div className="mb-2 px-1 text-sm font-semibold">Products</div>
                <ol className="rounded-2xl bg-card border divide-y overflow-hidden">
                  {productSug.map((p) => {
                    const imgUrl = p.images?.[0]?.url || "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                    return (
                      <li key={p.id}>
                        <Link
                          to="/products/$productId"
                          params={{ productId: p.id }}
                          onClick={() => {
                            push(p.name);
                            onClose();
                            setQ("");
                          }}
                          className="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <img
                            src={imgUrl}
                            alt={p.name}
                            className="h-11 w-11 shrink-0 rounded-xl object-cover bg-muted"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">
                              <Highlight text={p.name} q={debounced} />
                            </div>
                            <div className="text-[12px] text-muted-foreground tabular-nums">
                              ₹{p.price} · {p.unit}
                            </div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {vendorSug.length > 0 && (
              <section>
                <div className="mb-2 px-1 text-sm font-semibold">Vendors</div>
                <ol className="rounded-2xl bg-card border divide-y overflow-hidden">
                  {vendorSug.map((v) => (
                    <li key={v.id}>
                      <Link
                        to="/vendors/$vendorId"
                        params={{ vendorId: v.id }}
                        onClick={() => {
                          push(v.business_name);
                          onClose();
                          setQ("");
                        }}
                        className="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-primary">
                          <Store className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">
                            <Highlight text={v.business_name} q={debounced} />
                          </div>
                          <div className="text-[12px] text-muted-foreground truncate">
                            Vendor
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {!hasResults && (
              <div className="space-y-6 animate-fade-in">
                <div className="rounded-2xl bg-card border p-6 text-center shadow-soft">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-primary">
                    <Search className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-foreground">No direct matches for "{q}"</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Check out popular items available in your gali below!
                  </p>
                </div>

                <section>
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Popular Products You Might Like
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.slice(0, 6).map((p) => {
                      const imgUrl = p.images?.[0]?.url || "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                      return (
                        <Link
                          key={p.id}
                          to="/products/$productId"
                          params={{ productId: p.id }}
                          onClick={() => {
                            push(p.name);
                            onClose();
                            setQ("");
                          }}
                          className="group flex flex-col justify-between rounded-2xl bg-card border p-3 hover:border-emerald-500/50 hover:shadow-soft transition-all"
                        >
                          <div className="aspect-square w-full rounded-xl overflow-hidden bg-muted mb-2">
                            <img src={imgUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <div>
                            <div className="text-xs font-bold truncate text-foreground">{p.name}</div>
                            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">₹{p.price}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-emerald-100 px-0.5 text-primary">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

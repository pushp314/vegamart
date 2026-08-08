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

  const { data: pRes } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: vRes } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.get<Vendor[]>("/vendors"),
  });
  const { data: cRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

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
    navigate({ to: "/vendors", search: { q: t } });
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background pb-28 md:pb-16">
      {/* Sticky Search Header — matches app theme */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg border-b shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-4 pt-safe">
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted/50 hover:bg-muted tap-highlight-none transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(q)}
              placeholder="Search chai, sabzi, samosa, vendors…"
              className="h-12 w-full rounded-2xl bg-muted/50 pl-12 pr-24 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Clear"
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-background transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={startVoice}
                aria-label="Voice search"
                className={`grid h-9 w-9 place-items-center rounded-full transition-all ${
                  listening
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-primary hover:bg-background"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 space-y-8">
        {/* Voice listening state */}
        {listening && (
          <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-10 text-center animate-fade-in shadow-sm border border-emerald-200/50">
            <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl">
              <Mic className="h-10 w-10" />
              <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
            </div>
            <p className="mt-6 text-base font-bold text-primary">Listening…</p>
            <p className="mt-2 text-sm text-muted-foreground">Speak clearly to search</p>
            <div className="mt-4 flex items-end justify-center gap-1 h-10">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-primary transition-all duration-150"
                  style={{
                    height: `${10 + Math.abs(Math.sin((pulse + i) * 0.6)) * 30}px`,
                    opacity: 0.35 + Math.abs(Math.sin((pulse + i) * 0.6)) * 0.55,
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setListening(false)}
              className="mt-6 text-sm font-semibold text-primary underline underline-offset-4 hover:text-emerald-700 transition-colors"
            >
              Tap to cancel
            </button>
          </div>
        )}

        {/* Empty / initial state */}
        {!listening && !debounced && (
          <>
            {recent.length > 0 && (
              <section className="animate-fade-in">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-primary" /> Recent searches
                  </div>
                  <button
                    onClick={clear}
                    className="text-xs font-semibold text-primary hover:text-emerald-700 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <div
                      key={r}
                      className="group inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/50 pl-4 pr-1 py-2 text-sm hover:border-primary/30 hover:bg-card transition-all"
                    >
                      <button onClick={() => setQ(r)} className="inline-flex items-center gap-2 font-medium">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {r}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        aria-label={`Remove ${r}`}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="animate-fade-in">
              <div className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-amber-500" /> Trending searches
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      push(t);
                      setQ(t);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm hover:border-amber-500/50 hover:bg-amber-50/50 transition-all group"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <section className="animate-fade-in">
              <div className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Browse categories
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {categories.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      push(c.name);
                      onClose();
                      setQ("");
                      navigate({ to: "/products", search: { category: c.name } });
                    }}
                    className="rounded-2xl bg-card border border-border/50 p-4 text-left hover:border-primary/50 hover:bg-emerald-50/50 hover:shadow-sm transition-all group"
                  >
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-primary group-hover:from-emerald-200 group-hover:to-emerald-300 transition-all">
                      <ShoppingBasket className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold truncate text-foreground">{c.name}</div>
                    {/* Categories backend model doesn't have a count yet, we skip it */}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Suggestions */}
        {!listening && debounced && (
          <div className="space-y-6 animate-fade-in">
            <button
              onClick={() => submit(q)}
              className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-emerald-600 px-5 py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all transform hover:scale-[1.01]"
            >
              <span>See all results for "{q}"</span>
              <ArrowUpRight className="h-5 w-5" />
            </button>
            {categorySug.length > 0 && (
              <section>
                <div className="mb-3 px-1 text-sm font-semibold text-foreground">Categories</div>
                <div className="flex flex-wrap gap-2">
                  {categorySug.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        push(c.name);
                        onClose();
                        setQ("");
                        navigate({ to: "/products", search: { category: c.name } });
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm hover:border-primary/50 hover:bg-emerald-50/50 transition-all group"
                    >
                      <span className="h-2 w-2 rounded-full bg-primary group-hover:scale-125 transition-transform" />
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {productSug.length > 0 && (
              <section>
                <div className="mb-3 px-1 text-sm font-semibold text-foreground">Products</div>
                <ol className="rounded-2xl bg-card border border-border/50 divide-y divide-border/30 overflow-hidden shadow-sm">
                  {productSug.map((p) => {
                    const imgUrl =
                      p.images?.[0]?.url ||
                      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => {
                            push(p.name);
                            setQ("");
                            navigate({ to: "/products/$productId", params: { productId: p.id } }).then(() => {
                              onClose();
                            });
                          }}
                          className="w-full group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          <img
                            src={imgUrl}
                            alt={p.name}
                            className="h-14 w-14 shrink-0 rounded-xl object-cover bg-muted shadow-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate text-foreground">
                              <Highlight text={p.name} q={debounced} />
                            </div>
                            <div className="text-[13px] text-muted-foreground tabular-nums mt-0.5">
                              ₹{p.price} · {p.unit}
                            </div>
                          </div>
                          <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {vendorSug.length > 0 && (
              <section>
                <div className="mb-3 px-1 text-sm font-semibold text-foreground">Vendors</div>
                <ol className="rounded-2xl bg-card border border-border/50 divide-y divide-border/30 overflow-hidden shadow-sm">
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
                        className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-primary shadow-sm">
                          <Store className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate text-foreground">
                            <Highlight text={v.business_name} q={debounced} />
                          </div>
                          <div className="text-[13px] text-muted-foreground truncate">Vendor</div>
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {!hasResults && (
              <div className="space-y-8 animate-fade-in">
                <div className="rounded-3xl bg-gradient-to-br from-card to-muted/30 border border-border/50 p-8 text-center shadow-sm">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-primary shadow-lg">
                    <Search className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-foreground">
                    No direct matches for "{q}"
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Check out popular items available in your gali below!
                  </p>
                </div>

                <section>
                  <div className="mb-4 flex items-center justify-between px-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Popular Products You Might Like
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {products.slice(0, 6).map((p) => {
                      const imgUrl =
                        p.images?.[0]?.url ||
                        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop";
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            push(p.name);
                            setQ("");
                            navigate({ to: "/products/$productId", params: { productId: p.id } }).then(() => {
                              onClose();
                            });
                          }}
                          className="w-full text-left group flex flex-col justify-between rounded-2xl bg-card border border-border/50 p-4 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all"
                        >
                          <div className="aspect-square w-full rounded-xl overflow-hidden bg-muted mb-3 shadow-sm">
                            <img
                              src={imgUrl}
                              alt={p.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div>
                            <div className="text-sm font-bold truncate text-foreground">
                              {p.name}
                            </div>
                            <div className="text-xs font-semibold text-emerald-600 mt-1">
                              ₹{p.price}
                            </div>
                          </div>
                        </button>
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

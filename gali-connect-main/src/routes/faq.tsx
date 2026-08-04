import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "FAQ & Help — Vegamart" }] }),
  component: FAQPage,
});

function FAQPage() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const { data: res, isLoading } = useQuery({
    queryKey: ["faqs"],
    queryFn: () => api.get<any[]>("/faqs"),
  });

  const faqs = res?.data || [];

  const filtered = faqs.filter(
    (item: any) =>
      item.question.toLowerCase().includes(query.toLowerCase()) ||
      item.answer.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Frequently Asked Questions" subtitle="Instant answers to common queries" />

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions (e.g. delivery, payment, vendors)..."
            className="w-full rounded-2xl bg-card border h-11 pl-10 pr-4 text-xs font-semibold outline-none shadow-xs placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading FAQs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No FAQs found matching "{query}"
            </div>
          ) : (
            filtered.map((item: any, index: number) => {
              const isOpen = openIndex === index;
              return (
                <div key={index} className="border-b last:border-0 border-border overflow-hidden">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left bg-transparent hover:bg-muted/50 transition-colors"
                  >
                    <h3 className="font-semibold text-sm pr-4">{item.question}</h3>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-foreground" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="p-5 pt-0 text-[13px] text-muted-foreground leading-relaxed">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

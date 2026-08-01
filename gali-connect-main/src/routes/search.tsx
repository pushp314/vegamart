import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { SearchOverlay } from "@/components/marketplace/search-overlay";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Vegamart" },
      {
        name: "description",
        content: "Search chai, sabzi, samosa, vendors and more across your neighbourhood.",
      },
      { property: "og:title", content: "Search — Vegamart" },
      { property: "og:description", content: "Find products, vendors and categories on Vegamart." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const onClose = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/" });
  };
  return <SearchOverlay open onClose={onClose} />;
}

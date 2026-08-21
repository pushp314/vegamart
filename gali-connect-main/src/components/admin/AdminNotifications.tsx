import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  CheckCircle2,
  Flame,
  Globe,
  Info,
  Layers,
  Loader2,
  Megaphone,
  Plus,
  Radio,
  Send,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Users,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  banner_theme?: string;
  action_url?: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
}

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newAudience, setNewAudience] = useState<"all" | "customer" | "vendor" | "delivery">("all");
  const [newTheme, setNewTheme] = useState<"PROMO" | "ALERT" | "NOTICE" | "OFFER">("PROMO");
  const [newActionUrl, setNewActionUrl] = useState("");

  const { data: announcementsRes, isLoading } = useQuery({
    queryKey: ["adminAnnouncements", page],
    queryFn: () => api.get<any>(`/admin/announcements?page=${page}&per_page=20`),
  });

  const announcements: Announcement[] = Array.isArray(announcementsRes?.data)
    ? announcementsRes.data
    : Array.isArray((announcementsRes?.data as any)?.data)
      ? (announcementsRes?.data as any).data
      : [];

  const pagination = announcementsRes?.pagination as PaginationMeta | undefined;

  const createAnnouncementMutation = useMutation({
    mutationFn: (data: {
      title: string;
      body: string;
      audience: string;
      banner_theme?: string;
      action_url?: string;
      publish?: boolean;
    }) => api.post("/admin/announcements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Broadcast announcement created & sent!");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewActionUrl("");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create announcement"),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/announcements/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Broadcast published to users");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/announcements/${id}/unpublish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Broadcast unpublished");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Broadcast deleted");
    },
  });

  const getAudienceBadge = (aud: string) => {
    switch (aud?.toLowerCase()) {
      case "customer":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold">
            <Users className="h-3 w-3 mr-1" /> Customers
          </Badge>
        );
      case "vendor":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold">
            <Store className="h-3 w-3 mr-1" /> Vendors
          </Badge>
        );
      case "delivery":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">
            <Truck className="h-3 w-3 mr-1" /> Delivery Riders
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold">
            <Globe className="h-3 w-3 mr-1" /> Everyone (All)
          </Badge>
        );
    }
  };

  const getThemeBadge = (theme?: string) => {
    switch (theme) {
      case "PROMO":
      case "OFFER":
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] font-bold">
            <Flame className="h-3 w-3 mr-1" /> Promotional
          </Badge>
        );
      case "ALERT":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] font-bold">
            <Info className="h-3 w-3 mr-1" /> Notice / Alert
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] font-bold">
            <Radio className="h-3 w-3 mr-1" /> Announcement
          </Badge>
        );
    }
  };

  const activeCount = announcements.filter((a) => a.is_active).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Megaphone className="h-7 w-7" />
            </span>
            Broadcast & Push Notification Engine
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Send instant real-time marketing push notifications, promo banners, and advisories to customers, vendors, or riders.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4 mr-2" /> New Broadcast Campaign
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Campaigns
            </span>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Radio className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            {announcements.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">All-time drafted and sent</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Live Broadcasts
            </span>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-emerald-600">
            {activeCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Currently displaying across app</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Instant Push Channels
            </span>
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-display text-3xl font-black text-foreground">
            SSE / WebSockets
          </div>
          <p className="text-xs text-muted-foreground mt-1">Real-time live channel sync</p>
        </div>
      </div>

      {/* Campaigns Listing */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground">Campaign History & Feed</h3>
          <Badge variant="outline" className="text-xs">
            Page {page}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <Megaphone className="h-10 w-10 mx-auto text-primary/40 mb-2" />
            <div className="font-bold text-foreground">No Broadcasts Yet</div>
            <p className="text-xs mt-1">Create your first broadcast to engage users and vendors.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="p-5 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-foreground">{a.title}</span>
                    {getAudienceBadge(a.audience)}
                    {getThemeBadge(a.banner_theme)}
                    <Badge
                      className={`text-[10px] font-bold uppercase ${
                        a.is_active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.is_active ? "● Live / Active" : "Draft / Archived"}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span>Created: {format(new Date(a.created_at), "MMM d, yyyy • h:mm a")}</span>
                    {a.published_at && (
                      <span>Published: {format(new Date(a.published_at), "MMM d, yyyy")}</span>
                    )}
                    {a.action_url && (
                      <span className="font-mono text-primary truncate max-w-xs">
                        Action: {a.action_url}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {a.is_active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unpublishMutation.mutate(a.id)}
                      className="rounded-xl text-xs"
                    >
                      Unpublish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => publishMutation.mutate(a.id)}
                      className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Send className="h-3 w-3 mr-1.5" /> Publish Now
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this broadcast?")) deleteMutation.mutate(a.id);
                    }}
                    className="rounded-xl text-rose-600 hover:bg-rose-50 border-rose-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && (
          <div className="mt-6">
            <AdminPaginationBar pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Create Broadcast Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <Megaphone className="h-6 w-6 text-primary" />
              New Broadcast Push Campaign
            </DialogTitle>
            <DialogDescription>
              Draft promotional notifications or alerts and blast to target audiences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Audience Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Target Audience
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "all", label: "Everyone", icon: Globe },
                  { id: "customer", label: "Customers", icon: Users },
                  { id: "vendor", label: "Vendors", icon: Store },
                  { id: "delivery", label: "Riders", icon: Truck },
                ].map((aud) => {
                  const Icon = aud.icon;
                  const isSelected = newAudience === aud.id;
                  return (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setNewAudience(aud.id as any)}
                      className={`p-2.5 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/20"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{aud.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campaign Theme */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Campaign Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "PROMO", label: "🔥 Flash Sale / Promo", desc: "For offers & discounts" },
                  { id: "ALERT", label: "⚠️ Advisory / Notice", desc: "Important news or weather" },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setNewTheme(th.id as any)}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      newTheme === th.id
                        ? "border-primary bg-primary/5 font-bold ring-2 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-xs text-foreground font-bold">{th.label}</div>
                    <div className="text-[10px] text-muted-foreground">{th.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Broadcast Title
              </label>
              <Input
                placeholder="e.g. Weekend Special: 20% OFF on Fresh Mangoes!"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Message Content
              </label>
              <Textarea
                placeholder="Write message copy here. Keep it concise, engaging, and clear..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
                className="rounded-xl font-normal"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Redirect Action URL (Optional)
              </label>
              <Input
                placeholder="e.g. /categories/fruits or /vendor/orders"
                value={newActionUrl}
                onChange={(e) => setNewActionUrl(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                createAnnouncementMutation.mutate({
                  title: newTitle,
                  body: newBody,
                  audience: newAudience,
                  banner_theme: newTheme,
                  action_url: newActionUrl || undefined,
                  publish: true,
                })
              }
              disabled={!newTitle || !newBody || createAnnouncementMutation.isPending}
              className="rounded-xl bg-primary text-primary-foreground font-bold"
            >
              {createAnnouncementMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Blasting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Blast Broadcast Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Package,
  Heart,
  HelpCircle,
  LogOut,
  ChevronRight,
  Pencil,
  Store,
  ShieldAlert,
  Bell,
  Sparkles,
  X,
  Loader2,
  User as UserIcon,
  LogIn,
  MessageSquare,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/context/auth-context";
import { homePathForRole } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Vegamart" },
      { name: "description", content: "Manage your account, addresses, orders, and preferences." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { user, role, logout, isAuthenticated, isLoading, updateProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setAvatarPreviewUrl(user.avatar_url || "");
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Non-customer roles don't get the customer profile — send them to their portal.
  useEffect(() => {
    if (!isLoading && user && user.role !== "customer") {
      navigate({ to: homePathForRole(user.role) });
    }
  }, [user, isLoading, navigate]);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate({ to: "/login" });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);

    let finalAvatarUrl = user?.avatar_url;
    if (avatarFile) {
      const formData = new FormData();
      formData.append("file", avatarFile);
      formData.append("folder", "profiles");
      const uploadRes = await api.post<{ url: string; key: string }>("/uploads", formData);
      if (uploadRes.success && uploadRes.data?.url) {
        finalAvatarUrl = uploadRes.data.url;
      } else {
        toast.error("Avatar upload failed");
        setSaving(false);
        return;
      }
    }

    const res = await updateProfile({
      name,
      phone: phone || undefined,
      avatar_url: finalAvatarUrl,
    });
    setSaving(false);

    if (res.success) {
      setEditOpen(false);
      setAvatarFile(null);
      toast.success("Profile details updated!");
    } else {
      toast.error(res.message || "Failed to update profile");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-16 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading profile...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-16">
        <AppHeader title="Account" back={false} />
        <main className="mx-auto max-w-md px-4 pt-16 text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-primary">
            <UserIcon className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-bold">Sign in to view your profile</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manage your saved addresses, track orders, and edit account settings.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-sm px-6 py-3 shadow-md hover:bg-primary/90 transition-colors"
          >
            <LogIn className="h-4 w-4" /> Sign In / Register
          </Link>
        </main>
      </div>
    );
  }

  // Initials fallback for user avatar
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Account" back={false} />

      <main className="mx-auto max-w-4xl px-4 md:px-6 pt-4 md:pt-8 space-y-6">
        {/* Identity card */}
        <section className="flex items-center gap-4 rounded-3xl bg-card border p-5 shadow-soft">
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-16 w-16 rounded-2xl object-cover ring-2 ring-primary/30"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff&size=128`;
                }}
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary font-display font-bold text-xl flex items-center justify-center ring-2 ring-primary/30">
                {initials}
              </div>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-xs"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {role.toUpperCase()}
              </span>
            </div>
            <div className="truncate font-display text-lg font-bold leading-tight mt-1">
              {user.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {user.email} {user.phone ? `• ${user.phone}` : ""}
            </div>
          </div>

          <button
            onClick={() => setEditOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 rounded-2xl border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Edit Profile
          </button>
        </section>

        {/* Dashboard Quick Switcher if Vendor or Admin */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {role === "vendor" && (
            <Link
              to="/vendor"
              className="flex items-center justify-between rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 shadow-xs hover:bg-emerald-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold">Vendor Dashboard</div>
                  <div className="text-xs text-emerald-700">Manage store catalog & orders</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </Link>
          )}

          {(role === "admin" || role === "super_admin") && (
            <Link
              to="/admin"
              className="flex items-center justify-between rounded-3xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-xs hover:bg-amber-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-600 text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold">Admin Panel</div>
                  <div className="text-xs text-amber-700">Platform approvals & analytics</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </Link>
          )}

          {role === "customer" && (
            <Link
              to="/become-vendor"
              className="flex items-center justify-between rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 shadow-xs hover:bg-emerald-100/70 transition-colors col-span-full"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold">Become a Live Gali Vendor</div>
                  <div className="text-xs text-emerald-700">
                    Sell vegetables, chai or grocery to nearby customers
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </Link>
          )}
        </section>

        {/* Quick Nav Rows */}
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            My Account
          </h2>
          <div className="rounded-3xl border bg-card overflow-hidden divide-y">
            <Link
              to="/orders"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-primary">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">My Orders</div>
                  <div className="text-xs text-muted-foreground">Track live orders & history</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/addresses"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-700">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Saved Addresses</div>
                  <div className="text-xs text-muted-foreground">Manage delivery locations</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/wishlist"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700">
                  <Heart className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">My Wishlist</div>
                  <div className="text-xs text-muted-foreground">Saved products for later</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/notifications"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Notifications</div>
                  <div className="text-xs text-muted-foreground">Order updates & deals</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>

        {/* Support & Legal Links */}
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Support & Info
          </h2>
          <div className="rounded-3xl border bg-card overflow-hidden divide-y">
            <Link
              to="/faq"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-purple-700">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="text-sm font-bold text-foreground">FAQ & Help Center</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/contact"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-100 text-cyan-700">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="text-sm font-bold text-foreground">Contact Support</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/about"
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm font-bold text-foreground">About Vegamart</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border bg-card py-3.5 text-sm font-bold text-destructive hover:bg-rose-50/50 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </main>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-card border rounded-3xl p-6 shadow-glow">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-display text-base font-bold">Edit Profile</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSaveProfile}>
              {/* Avatar Upload */}
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-full bg-accent border border-border shrink-0 flex items-center justify-center">
                  {avatarFile ? (
                    <img
                      src={URL.createObjectURL(avatarFile)}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                  ) : avatarPreviewUrl ? (
                    <img
                      src={avatarPreviewUrl}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAvatarFile(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
              </div>

              <label className="block">
                <div className="mb-1 text-xs font-semibold text-foreground">Full Name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold text-foreground">Phone Number</div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter mobile number"
                  className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none"
                />
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-2xl border bg-muted py-2.5 text-xs font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

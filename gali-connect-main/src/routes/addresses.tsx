import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Home,
  Briefcase,
  Building,
  Loader2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AddressModal, AddressData } from "@/components/marketplace/address-modal";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/addresses")({
  head: () => ({ meta: [{ title: "Saved Addresses — Vegamart" }] }),
  component: AddressesPage,
});

function AddressesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<AddressData | null>(null);

  const { user } = useAuth();
  const { data: addrRes, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<{ data: any[] }>("/users/me/addresses"),
    enabled: !!user,
  });

  const addresses: AddressData[] = (addrRes?.data as unknown as AddressData[]) || [];

  const saveMutation = useMutation({
    mutationFn: async (data: AddressData) => {
      const res =
        data.id && !data.id.startsWith("addr_")
          ? await api.put(`/users/me/addresses/${data.id}`, data)
          : await api.post("/users/me/addresses", data);

      if (!res.success) {
        throw new Error(res.error?.message || "Failed to save address");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success(editingAddr ? "Address updated successfully" : "New address added");
      setModalOpen(false);
    },
    onError: () => {
      toast.error("Failed to save address");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/me/addresses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address deleted");
    },
    onError: () => {
      toast.error("Failed to delete address");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.put(`/users/me/addresses/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Default address updated");
    },
    onError: () => {
      toast.error("Failed to update default address");
    },
  });

  const handleSave = async (newAddr: AddressData) => {
    return saveMutation.mutateAsync(newAddr);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Saved Addresses" subtitle="Manage delivery locations" />

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block font-display text-2xl font-bold">Saved Addresses</h1>
          <button
            onClick={() => {
              setEditingAddr(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs px-4 py-2.5 shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add New Address
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading addresses...
          </div>
        ) : addresses.length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold">No saved addresses</h3>
            <p className="text-xs text-muted-foreground">Add an address to speed up checkout</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => {
              const Icon =
                addr.label === "Home" ? Home : addr.label === "Work" ? Briefcase : Building;
              return (
                <div
                  key={addr.id}
                  className={`rounded-3xl border p-4 transition-all bg-card ${
                    addr.is_default
                      ? "border-primary/60 ring-2 ring-primary/20 shadow-soft"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-muted text-foreground font-bold">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold">{addr.label}</span>
                          {addr.is_default && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 text-primary text-[10px] font-bold px-2 py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-foreground mt-0.5">
                          {addr.full_name} • {addr.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingAddr(addr);
                          setModalOpen(true);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(addr.id!)}
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed pl-10">
                    {addr.line1}, {addr.line2 && `${addr.line2}, `}
                    {addr.city}, {addr.state} — <strong>{addr.pincode}</strong>
                  </p>

                  {!addr.is_default && (
                    <div className="mt-3 pt-3 border-t pl-10">
                      <button
                        onClick={() => handleSetDefault(addr.id!)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Set as default address
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AddressModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingAddr}
      />
    </div>
  );
}

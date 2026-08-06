import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";

export function AdminFAQ() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    is_active: true
  });

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin_faqs"],
    queryFn: () => api.get<any>("/faqs/admin"),
  });
  
  const faqs = res?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/faqs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_faqs"] });
      toast.success("FAQ created successfully");
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("Failed to create FAQ"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.put(`/faqs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_faqs"] });
      toast.success("FAQ updated successfully");
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("Failed to update FAQ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/faqs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_faqs"] });
      toast.success("FAQ deleted");
    },
    onError: () => toast.error("Failed to delete FAQ"),
  });

  const resetForm = () => {
    setFormData({ question: "", answer: "", is_active: true });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question || !formData.answer) {
      toast.error("Please fill all required fields");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Manage FAQs</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Add FAQ"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-lg">{editingId ? "Edit FAQ" : "New FAQ"}</h3>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Question</label>
            <input
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="e.g. How do I track my order?"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Answer</label>
            <textarea
              value={formData.answer}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary min-h-[100px]"
              placeholder="Enter the answer..."
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="is_active" className="text-sm">Active (visible to users)</label>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save FAQ"}
          </button>
        </form>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading FAQs...</div>
        ) : faqs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No FAQs added yet.</div>
        ) : (
          <div className="divide-y">
            {faqs.map((faq: any) => (
              <div key={faq.id} className="p-4 flex gap-4 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{faq.question}</h4>
                    {!faq.is_active && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">Draft</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{faq.answer}</p>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setFormData({
                        question: faq.question,
                        answer: faq.answer,
                        is_active: faq.is_active,
                      });
                      setEditingId(faq.id);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this FAQ?")) {
                        deleteMutation.mutate(faq.id);
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  targetType: "product" | "vendor";
  onSuccess?: () => void;
}

export function ReviewModal({
  open,
  onClose,
  targetId,
  targetName,
  targetType,
  onSuccess,
}: ReviewModalProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Please select a star rating");
      return;
    }

    if (!isAuthenticated) {
      toast.info("Please sign in to submit a review.");
      navigate({ to: "/login", search: { redirect: window.location.pathname } });
      return;
    }

    if (!targetId) {
      toast.error("Invalid target for review.");
      return;
    }

    setSubmitting(true);
    const endpoint = targetType === "vendor" ? `/vendors/${targetId}/reviews` : `/products/${targetId}/reviews`;
    
    const res = await api.post(endpoint, {
      rating,
      comment: comment.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      setRating(5);
      setComment("");
      toast.success(res.message || `Thank you! Review for ${targetName} submitted successfully.`);
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast.error(res.error?.message || "Failed to submit review. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-card border rounded-3xl p-6 shadow-glow">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-display text-base font-bold">Write a Review</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-4 space-y-4 text-center" onSubmit={handleSubmit}>
          <p className="text-xs text-muted-foreground">
            Share your experience for <strong className="text-foreground">{targetName}</strong>
          </p>

          {/* Star Selector */}
          <div className="flex items-center justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoverRating || rating);
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-125"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      active ? "fill-amber-400 text-amber-400" : "text-gray-300"
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <div className="text-xs font-bold text-amber-600">
            {rating === 5 && "Excellent! ⭐⭐⭐⭐⭐"}
            {rating === 4 && "Very Good! ⭐⭐⭐⭐"}
            {rating === 3 && "Average ⭐⭐⭐"}
            {rating === 2 && "Poor ⭐⭐"}
            {rating === 1 && "Terrible ⭐"}
          </div>

          <label className="block text-left">
            <div className="mb-1 text-xs font-semibold text-foreground">Your Review (Optional)</div>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others what you loved about this produce or vendor..."
              className="w-full rounded-2xl bg-muted border p-3 text-xs outline-none placeholder:text-muted-foreground resize-none"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border bg-muted py-2.5 text-xs font-semibold text-muted-foreground hover:bg-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs py-2.5 hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

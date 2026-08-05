import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  order: { id: string; order_number: string } | null;
}

export function VendorReviews() {
  const { data: reviewsRes, isLoading } = useQuery({
    queryKey: ["vendorReviews"],
    queryFn: () => api.get<any>("/vendors/me/reviews"),
  });

  const reviews: Review[] = Array.isArray(reviewsRes?.data)
    ? reviewsRes.data
    : Array.isArray((reviewsRes?.data as any)?.data)
      ? (reviewsRes?.data as any).data
      : [];

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    percentage: reviews.length
      ? (reviews.filter((r) => r.rating === stars).length / reviews.length) * 100
      : 0,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-bold">Reviews & Ratings</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-sm text-muted-foreground">Average Rating</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold">{avgRating}</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(Number(avgRating))
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{reviews.length} reviews</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ratingDistribution.map((dist) => (
              <div key={dist.stars} className="flex items-center gap-2">
                <span className="text-sm w-8">{dist.stars}★</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${dist.percentage}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8">{dist.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No reviews yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{review.user?.name ?? "Customer"}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(review.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  {review.product && (
                    <p className="text-xs text-muted-foreground">
                      for <span className="font-medium">{review.product.name}</span>
                    </p>
                  )}
                  {review.comment && (
                    <p className="text-sm">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

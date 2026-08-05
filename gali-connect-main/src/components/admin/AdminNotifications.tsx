import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
}

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newAudience, setNewAudience] = useState("all");

  const { data: announcementsRes, isLoading } = useQuery({
    queryKey: ["adminAnnouncements"],
    queryFn: () => api.get<any>("/admin/announcements"),
  });

  const announcements: Announcement[] = Array.isArray(announcementsRes?.data)
    ? announcementsRes.data
    : Array.isArray((announcementsRes?.data as any)?.data)
      ? (announcementsRes?.data as any).data
      : [];

  const createAnnouncementMutation = useMutation({
    mutationFn: (data: { title: string; body: string; audience: string }) =>
      api.post("/admin/announcements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Announcement created");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewBody("");
    },
    onError: () => toast.error("Failed to create announcement"),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/announcements/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Announcement published");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/announcements/${id}/unpublish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      toast.success("Announcement unpublished");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications & Announcements</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Textarea
                placeholder="Body"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
              />
              <select
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="all">All Users</option>
                <option value="customer">Customers</option>
                <option value="vendor">Vendors</option>
                <option value="delivery">Delivery Partners</option>
              </select>
              <Button
                onClick={() =>
                  createAnnouncementMutation.mutate({
                    title: newTitle,
                    body: newBody,
                    audience: newAudience,
                  })
                }
                disabled={!newTitle || !newBody}
              >
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No announcements
                    </TableCell>
                  </TableRow>
                ) : (
                  announcements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.audience}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.is_active ? "default" : "secondary"}>
                          {a.is_active ? "Active" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.published_at
                          ? format(new Date(a.published_at), "MMM d, yyyy")
                          : "Not published"}
                      </TableCell>
                      <TableCell>{format(new Date(a.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {a.published_at ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unpublishMutation.mutate(a.id)}
                          >
                            Unpublish
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => publishMutation.mutate(a.id)}
                          >
                            Publish
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

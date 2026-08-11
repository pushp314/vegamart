import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { AdminPaginationBar } from "./AdminPaginationBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export function AdminSupportTickets() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: ticketsRes, isLoading } = useQuery({
    queryKey: ["adminSupportTickets", search, page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("per_page", "20");
      return api.get<any>(`/admin/support-tickets?${params.toString()}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/support-tickets/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSupportTickets"] });
      toast.success("Ticket status updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update ticket status"),
  });

  const tickets = ticketsRes?.data?.rows || ticketsRes?.data?.data?.rows || [];
  const ticketMeta = ticketsRes?.data?.data ?? ticketsRes?.data ?? {};

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Support Tickets
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and resolve customer support requests.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card border border-border p-3 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets by subject or user..."
            className="pl-10 rounded-xl bg-muted/50 border-transparent focus:bg-background w-full"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="ESCALATED">Escalated</option>
        </select>
      </div>

      <div className="rounded-3xl border bg-card p-0 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">
                  Ticket ID & Subject
                </TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">
                  User
                </TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">
                  Status & Priority
                </TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">
                  Created At
                </TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    No support tickets found
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket: any) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <p className="font-bold text-sm text-foreground">{ticket.subject}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {ticket.id}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 max-w-md">
                        {ticket.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm text-foreground">
                        {ticket.user?.name || "Anonymous"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.user?.email || "No email"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2 items-start">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                          ${
                            ticket.status === "OPEN"
                              ? "bg-amber-100 text-amber-800"
                              : ticket.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800"
                                : ticket.status === "RESOLVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ticket.status === "CLOSED"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {ticket.status}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase border border-border px-1.5 py-0.5 rounded">
                          {ticket.priority}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ticket.created_at), "MMM d, yyyy HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <select
                        className="h-8 px-2 rounded-md border bg-background text-xs cursor-pointer focus:ring-1 focus:ring-primary/20 outline-none"
                        value={ticket.status}
                        onChange={(e) => {
                          if (confirm(`Change status to ${e.target.value}?`)) {
                            updateStatusMutation.mutate({ id: ticket.id, status: e.target.value });
                          }
                        }}
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                        <option value="ESCALATED">Escalated</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <AdminPaginationBar
        pagination={{
          page: Number(ticketMeta.page) || 1,
          per_page: Number(ticketMeta.per_page) || 20,
          total: Number(ticketMeta.total) || 0,
          total_pages: Number(ticketMeta.total_pages) || 1,
          has_next: Number(ticketMeta.page || 1) < Number(ticketMeta.total_pages || 1),
          has_prev: Number(ticketMeta.page || 1) > 1,
        }}
        onPageChange={setPage}
      />
    </div>
  );
}

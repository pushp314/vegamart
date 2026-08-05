import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  new_values: any;
  created_at: string;
  user: { id: string; name: string; email: string } | null;
}

export function AdminAuditLogs() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: logsRes, isLoading } = useQuery({
    queryKey: ["adminAuditLogs", search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      params.set("page", String(page));
      params.set("per_page", "20");
      return api.get<any>(`/admin/audit-logs?${params.toString()}`);
    },
  });

  const logs: AuditLog[] = Array.isArray(logsRes?.data)
    ? logsRes.data
    : Array.isArray((logsRes?.data as any)?.data)
      ? (logsRes?.data as any).data
      : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Audit Logs</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
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
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.user?.name ?? "System"}</p>
                          <p className="text-xs text-muted-foreground">{log.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{log.entity_type}</p>
                          <p className="text-xs text-muted-foreground font-mono">{log.entity_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.new_values && (
                          <pre className="text-xs bg-muted p-2 rounded max-w-xs overflow-auto">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
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

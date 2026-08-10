import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Mail, CheckCircle2, X, Wrench } from "lucide-react";
import { toast } from "sonner";
import { getMaintenanceStatus, completeMaintenanceTask, type MaintenanceTask } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const severityStyles: Record<MaintenanceTask["severity"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

const severityLabel: Record<MaintenanceTask["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildContactMailto(
  tasks: MaintenanceTask[],
  contactEmail: string,
  requestedBy: string,
): string {
  const lines = tasks
    .map(
      (t) =>
        `${t.label} (${t.dev_note}) - due ${formatDate(t.due_at)}${
          t.overdue_days > 0 ? `, ${t.overdue_days} day(s) overdue` : ""
        }`,
    )
    .join("\n");
  const subject = encodeURIComponent("Maintenance needed for VegaMart");
  const body = encodeURIComponent(
    [
      "Hi,",
      "",
      "The following maintenance work is now due for the VegaMart platform:",
      "",
      lines,
      "",
      "Please contact me to schedule this maintenance.",
      "",
      `Requested by: ${requestedBy}`,
    ].join("\n"),
  );
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}

export function MaintenanceAlertModal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: statusRes, isLoading } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: getMaintenanceStatus,
  });

  const status = statusRes?.success ? statusRes.data : null;
  const dueTasks = (status?.tasks ?? []).filter((t) => t.status === "due");
  const contactEmail = status?.contact.contact_email ?? "";
  const show = !isLoading && dueTasks.length > 0 && !dismissed;

  const completeMutation = useMutation({
    mutationFn: (type: string) => completeMaintenanceTask(type),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.setQueryData(["maintenance-status"], res);
      } else {
        queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
        toast.error(res.error?.message || "Failed to reschedule maintenance task");
      }
      toast.success("Maintenance task rescheduled");
    },
    onError: () => toast.error("Failed to reschedule maintenance task"),
  });

  const handleContact = () => {
    if (!contactEmail) {
      toast.error("No developer contact email is set. Add one in Settings > Maintenance.");
      return;
    }
    window.location.href = buildContactMailto(
      dueTasks,
      contactEmail,
      user?.email ?? "Platform Admin",
    );
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && setDismissed(true)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Maintenance Required
          </DialogTitle>
          <DialogDescription>
            Your website is due for maintenance. Let the developer know what work is needed so it
            can be scheduled.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {dueTasks.map((task) => (
            <div
              key={task.type}
              className="flex items-start justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-semibold">{task.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={severityStyles[task.severity]}>
                    {severityLabel[task.severity]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {task.overdue_days > 0
                      ? `${task.overdue_days} day(s) overdue`
                      : `Due today (${formatDate(task.due_at)})`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{task.description}</p>
                <p className="text-xs font-medium">{task.dev_note}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => completeMutation.mutate(task.type)}
                disabled={completeMutation.isPending}
                className="shrink-0"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Done
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4 mr-2" />
            Remind me later
          </Button>
          <Button onClick={handleContact} disabled={!contactEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Contact Developer
          </Button>
        </DialogFooter>
        {!contactEmail && (
          <p className="text-xs text-muted-foreground">
            Tip: add the developer email/phone in Settings - Maintenance so the contact button
            works.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  RotateCcw,
  Calendar,
  Save,
  Loader2,
  Sparkles,
  Timer,
  ChevronDown,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Vendor,
  VendorProfile,
  DayOfWeek,
  StoreScheduleConfig,
  StoreDaySchedule,
} from "@/types";

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24 || "";
  const parts = time24.split(":");
  let hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mPad = String(minutes).padStart(2, "0");
  return `${hours}:${mPad} ${ampm}`;
}

const DEFAULT_DAYS: Record<DayOfWeek, StoreDaySchedule> = {
  monday: { isOpen: true, open: "10:00", close: "19:00" },
  tuesday: { isOpen: true, open: "10:00", close: "19:00" },
  wednesday: { isOpen: true, open: "10:00", close: "19:00" },
  thursday: { isOpen: true, open: "10:00", close: "19:00" },
  friday: { isOpen: true, open: "10:00", close: "19:00" },
  saturday: { isOpen: true, open: "10:00", close: "19:00" },
  sunday: { isOpen: true, open: "10:00", close: "19:00" },
};

interface StoreTimingSettingsProps {
  vendorProfile?: VendorProfile | Vendor | any;
}

export function StoreTimingSettings({ vendorProfile }: StoreTimingSettingsProps) {
  const queryClient = useQueryClient();

  const initialSchedule: StoreScheduleConfig = vendorProfile?.store_schedule && typeof vendorProfile.store_schedule === "object" && vendorProfile.store_schedule.days
    ? {
        timezone: vendorProfile.store_schedule.timezone || "Asia/Kolkata",
        useSameHours: vendorProfile.store_schedule.useSameHours !== false,
        defaultOpen: vendorProfile.store_schedule.defaultOpen || "10:00",
        defaultClose: vendorProfile.store_schedule.defaultClose || "19:00",
        days: { ...DEFAULT_DAYS, ...vendorProfile.store_schedule.days },
      }
    : {
        timezone: "Asia/Kolkata",
        useSameHours: true,
        defaultOpen: "10:00",
        defaultClose: "19:00",
        days: DEFAULT_DAYS,
      };

  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState<boolean>(
    Boolean(vendorProfile?.auto_schedule_enabled)
  );
  const [useSameHours, setUseSameHours] = useState<boolean>(initialSchedule.useSameHours !== false);
  const [defaultOpen, setDefaultOpen] = useState<string>(initialSchedule.defaultOpen || "10:00");
  const [defaultClose, setDefaultClose] = useState<string>(initialSchedule.defaultClose || "19:00");
  const [daysSchedule, setDaysSchedule] = useState<Record<DayOfWeek, StoreDaySchedule>>(
    initialSchedule.days
  );
  const [showCustomHours, setShowCustomHours] = useState<boolean>(!useSameHours);
  const [tempCloseMinutes, setTempCloseMinutes] = useState<string>("60");

  const availability = vendorProfile?.store_availability;
  const isEffectiveOpen = availability ? availability.isOpen : Boolean(vendorProfile?.is_open);
  const overrideStatus = vendorProfile?.manual_override_status;

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put("/vendors/me/availability", payload);
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, "Failed to update store timing"));
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myVendor"] });
      queryClient.invalidateQueries({ queryKey: ["vendor"] });
      toast.success("Store schedule & business hours saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save store timing");
    },
  });

  const handleSaveSchedule = () => {
    // If using same hours, apply defaultOpen/defaultClose to all days that are marked open
    const finalDays = { ...daysSchedule };
    if (useSameHours) {
      for (const d of DAYS) {
        finalDays[d.key] = {
          ...finalDays[d.key],
          open: defaultOpen,
          close: defaultClose,
        };
      }
    }

    const payload = {
      auto_schedule_enabled: autoScheduleEnabled,
      store_schedule: {
        timezone: "Asia/Kolkata",
        useSameHours,
        defaultOpen,
        defaultClose,
        days: finalDays,
      },
    };

    saveMutation.mutate(payload);
  };

  const handleManualAction = (action: "FORCE_OPEN" | "FORCE_CLOSE" | "RESUME" | "TEMPORARY_CLOSE") => {
    if (action === "RESUME") {
      saveMutation.mutate({
        manual_override_status: "NONE",
        manual_override_until: null,
      });
      toast.info("Resumed automated store schedule.");
      return;
    }

    if (action === "FORCE_OPEN") {
      saveMutation.mutate({
        is_open: true,
        manual_override_status: "FORCE_OPEN",
        manual_override_until: null,
      });
      toast.success("Store manually opened.");
      return;
    }

    if (action === "FORCE_CLOSE") {
      saveMutation.mutate({
        is_open: false,
        manual_override_status: "FORCE_CLOSE",
        manual_override_until: null,
      });
      toast.warning("Store manually closed.");
      return;
    }

    if (action === "TEMPORARY_CLOSE") {
      const mins = parseInt(tempCloseMinutes, 10) || 60;
      saveMutation.mutate({
        is_open: false,
        manual_override_status: "TEMPORARY_CLOSE",
        manual_override_minutes: mins,
      });
      toast.warning(`Store temporarily closed for ${mins} minutes.`);
      return;
    }
  };

  const updateDaySchedule = (day: DayOfWeek, field: keyof StoreDaySchedule, value: any) => {
    setDaysSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              Store Business Hours & Automated Schedule
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Automated
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure daily opening and closing hours. Your store will open and close automatically.
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold border ${
              isEffectiveOpen
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${isEffectiveOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span>{isEffectiveOpen ? "STORE IS OPEN" : "STORE IS CLOSED"}</span>
          </div>
        </div>
      </div>

      {/* Current Availability & Schedule Status Banner */}
      <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Timer className="h-4 w-4 text-primary shrink-0" />
            <span>
              {availability?.displayMessage ||
                (isEffectiveOpen ? "Store is currently accepting orders." : "Store is closed.")}
            </span>
          </div>
          {overrideStatus && overrideStatus !== "NONE" && (
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-300">
              Manual Override: {overrideStatus.replace("_", " ")}
            </span>
          )}
        </div>

        {/* Manual Override Controls */}
        <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Manual Actions:
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => handleManualAction("FORCE_OPEN")}
            className="text-xs h-8 rounded-xl font-bold border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
          >
            <Play className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            Manual Open
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => handleManualAction("FORCE_CLOSE")}
            className="text-xs h-8 rounded-xl font-bold border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
          >
            <Square className="h-3.5 w-3.5 mr-1 text-rose-600" />
            Manual Close
          </Button>

          {/* Temporary Close Presets */}
          <div className="flex items-center gap-1.5">
            <select
              value={tempCloseMinutes}
              onChange={(e) => setTempCloseMinutes(e.target.value)}
              className="h-8 rounded-xl border bg-background text-xs px-2.5 font-bold focus:outline-none"
            >
              <option value="30">30 Mins</option>
              <option value="60">1 Hour</option>
              <option value="120">2 Hours</option>
              <option value="240">4 Hours</option>
              <option value="480">8 Hours</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => handleManualAction("TEMPORARY_CLOSE")}
              className="text-xs h-8 rounded-xl font-bold border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              Temp Close
            </Button>
          </div>

          {overrideStatus && overrideStatus !== "NONE" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => handleManualAction("RESUME")}
              className="text-xs h-8 rounded-xl font-bold text-primary hover:bg-primary/10 ml-auto"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Resume Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Main Automation Toggle */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-background">
        <div className="space-y-0.5">
          <label className="text-sm font-bold text-foreground flex items-center gap-2">
            Enable Automatic Daily Store Scheduling
          </label>
          <p className="text-xs text-muted-foreground">
            When enabled, your store opens and closes automatically based on configured hours without daily manual effort.
          </p>
        </div>
        <Switch
          checked={autoScheduleEnabled}
          onCheckedChange={(checked) => setAutoScheduleEnabled(checked)}
        />
      </div>

      {autoScheduleEnabled && (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Quick Schedule Mode Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setUseSameHours(true);
                setShowCustomHours(false);
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                useSameHours
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="font-bold text-xs text-foreground flex items-center justify-between">
                <span>Same Hours Every Day</span>
                {useSameHours && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Same opening and closing time applied Monday through Sunday.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setUseSameHours(false);
                setShowCustomHours(true);
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                !useSameHours
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="font-bold text-xs text-foreground flex items-center justify-between">
                <span>Custom Hours by Day</span>
                {!useSameHours && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Configure different timings or day-off for individual days.
              </p>
            </button>
          </div>

          {/* Master Opening & Closing Times */}
          <div className="p-4 rounded-2xl border border-border bg-background space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {useSameHours ? "Daily Operating Hours" : "Default Operating Hours"}
              </span>
              <span className="text-[11px] text-muted-foreground">Timezone: Asia/Kolkata (IST)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Store Opening Time</span>
                  <span className="text-emerald-600 font-mono font-bold text-[11px]">
                    {formatTime12h(defaultOpen)}
                  </span>
                </label>
                <Input
                  type="time"
                  value={defaultOpen}
                  onChange={(e) => {
                    setDefaultOpen(e.target.value);
                    if (useSameHours) {
                      for (const d of DAYS) {
                        updateDaySchedule(d.key, "open", e.target.value);
                      }
                    }
                  }}
                  className="bg-card font-mono text-sm font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Store Closing Time</span>
                  <span className="text-rose-600 font-mono font-bold text-[11px]">
                    {formatTime12h(defaultClose)}
                  </span>
                </label>
                <Input
                  type="time"
                  value={defaultClose}
                  onChange={(e) => {
                    setDefaultClose(e.target.value);
                    if (useSameHours) {
                      for (const d of DAYS) {
                        updateDaySchedule(d.key, "close", e.target.value);
                      }
                    }
                  }}
                  className="bg-card font-mono text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          {/* 7-Day Custom Schedule Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                7-Day Weekly Breakdown
              </span>
              {useSameHours && (
                <button
                  type="button"
                  onClick={() => setShowCustomHours(!showCustomHours)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  {showCustomHours ? "Hide Details" : "View / Customize Individual Days"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCustomHours ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            {(showCustomHours || !useSameHours) && (
              <div className="space-y-2 rounded-2xl border border-border bg-background p-3.5 divide-y divide-border/60 animate-in fade-in duration-200">
                {DAYS.map((day) => {
                  const schedule = daysSchedule[day.key] || { isOpen: true, open: defaultOpen, close: defaultClose };
                  return (
                    <div
                      key={day.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3"
                    >
                      <div className="flex items-center gap-3 w-36">
                        <Switch
                          checked={schedule.isOpen}
                          onCheckedChange={(checked) => updateDaySchedule(day.key, "isOpen", checked)}
                        />
                        <span className={`text-xs font-bold ${schedule.isOpen ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {day.label}
                        </span>
                      </div>

                      {schedule.isOpen ? (
                        <div className="flex items-center gap-2.5 flex-1 max-w-sm">
                          <div className="flex-1">
                            <Input
                              type="time"
                              value={schedule.open}
                              disabled={!schedule.isOpen}
                              onChange={(e) => updateDaySchedule(day.key, "open", e.target.value)}
                              className="h-8 text-xs font-mono bg-card"
                            />
                          </div>
                          <span className="text-xs text-muted-foreground font-bold">to</span>
                          <div className="flex-1">
                            <Input
                              type="time"
                              value={schedule.close}
                              disabled={!schedule.isOpen}
                              onChange={(e) => updateDaySchedule(day.key, "close", e.target.value)}
                              className="h-8 text-xs font-mono bg-card"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-16 text-right hidden sm:inline-block">
                            {formatTime12h(schedule.close)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 max-w-sm py-1 px-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
                          Store Closed all day
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-3 border-t border-border">
        <Button
          type="button"
          onClick={handleSaveSchedule}
          disabled={saveMutation.isPending}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 shadow-md flex items-center gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Schedule...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Operating Hours
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

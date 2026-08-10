import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import {
  MAINTENANCE_SCHEDULE_KEY,
  MAINTENANCE_TASKS,
  addDays,
  overdueDays,
  type MaintenanceTaskDefinition,
} from "../constants/maintenance";
import type { Prisma } from "@prisma/client";
import * as settingsRepo from "../repositories/settings.repository";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { auditService } from "./audit.service";

interface TaskState {
  done_at: string | null;
}

interface ScheduleState {
  baseline: string;
  tasks: Record<string, TaskState>;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface MaintenanceTaskView extends MaintenanceTaskDefinition {
  done_at: string | null;
  due_at: string;
  status: "due" | "upcoming";
  overdue_days: number;
}

export interface MaintenanceStatus {
  baseline: string;
  contact: { contact_email: string | null; contact_phone: string | null };
  next_due_at: string | null;
  tasks: MaintenanceTaskView[];
}

function defaultState(now = new Date()): ScheduleState {
  return {
    baseline: now.toISOString(),
    tasks: {},
    contact_email: null,
    contact_phone: null,
  };
}

function parseState(value: Prisma.JsonValue | null | undefined): ScheduleState | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as Partial<ScheduleState>;
    if (typeof parsed.baseline !== "string") return null;
    return {
      baseline: parsed.baseline,
      tasks: parsed.tasks ?? {},
      contact_email: typeof parsed.contact_email === "string" ? parsed.contact_email : null,
      contact_phone: typeof parsed.contact_phone === "string" ? parsed.contact_phone : null,
    };
  } catch {
    return null;
  }
}

async function readState(now = new Date()): Promise<ScheduleState> {
  const row = await settingsRepo.getByKey(MAINTENANCE_SCHEDULE_KEY);
  const state = parseState(row?.value);
  if (state) return state;
  return defaultState(now);
}

async function persistState(state: ScheduleState): Promise<void> {
  await settingsRepo.upsertSetting({
    key: MAINTENANCE_SCHEDULE_KEY,
    value: JSON.stringify(state) as Prisma.InputJsonValue,
    type: "string",
    description: "Maintenance schedule state (JSON) managed by the maintenance reminders module.",
    is_public: false,
  });
}

function taskView(task: MaintenanceTaskDefinition, state: ScheduleState, now: Date): MaintenanceTaskView {
  const doneAt = state.tasks[task.type]?.done_at ?? state.baseline;
  const dueAt = addDays(new Date(doneAt), task.cadence_days);
  return {
    ...task,
    done_at: doneAt,
    due_at: dueAt.toISOString(),
    status: dueAt.getTime() <= now.getTime() ? "due" : "upcoming",
    overdue_days: overdueDays(dueAt, now),
  };
}

function buildStatus(state: ScheduleState, now = new Date()): MaintenanceStatus {
  const tasks = MAINTENANCE_TASKS.map((task) => taskView(task, state, now));
  const upcomingDue = tasks
    .filter((task) => task.status === "upcoming")
    .map((task) => new Date(task.due_at).getTime());
  const nextDueAt =
    upcomingDue.length > 0 ? new Date(Math.min(...upcomingDue)).toISOString() : null;
  return {
    baseline: state.baseline,
    contact: { contact_email: state.contact_email, contact_phone: state.contact_phone },
    next_due_at: nextDueAt,
    tasks,
  };
}

export const maintenanceService = {
  async getStatus(): Promise<MaintenanceStatus> {
    const state = await readState();
    return buildStatus(state);
  },

  async markDone(type: string, adminUserId: string, req?: Request): Promise<MaintenanceStatus> {
    const task = MAINTENANCE_TASKS.find((t) => t.type === type);
    if (!task) {
      throw new ApiError(HttpStatus.NOT_FOUND, `Unknown maintenance task type: ${type}`, {
        code: "MAINTENANCE_TASK_NOT_FOUND",
      });
    }
    const state = await readState();
    const doneAt = new Date().toISOString();
    state.tasks[task.type] = { done_at: doneAt };
    await persistState(state);

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.MAINTENANCE_TASK_COMPLETED,
        entityType: "maintenance",
        entityId: task.type,
        newValues: { type: task.type, done_at: doneAt },
      },
      req
    );

    return buildStatus(state);
  },

  async updateContact(
    contact: { contact_email?: string | null; contact_phone?: string | null },
    adminUserId: string,
    req?: Request
  ): Promise<MaintenanceStatus> {
    const state = await readState();
    const oldValues: Record<string, unknown> = {
      contact_email: state.contact_email,
      contact_phone: state.contact_phone,
    };
    if (contact.contact_email !== undefined) state.contact_email = contact.contact_email || null;
    if (contact.contact_phone !== undefined) state.contact_phone = contact.contact_phone || null;
    await persistState(state);

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.MAINTENANCE_CONTACT_UPDATED,
        entityType: "maintenance",
        oldValues,
        newValues: { contact_email: state.contact_email, contact_phone: state.contact_phone },
      },
      req
    );

    return buildStatus(state);
  },
};
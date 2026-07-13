import {
  pgTable,
  bigserial,
  text,
  integer,
  date,
  timestamp,
  numeric,
  jsonb,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { planningPlansTable } from "./planning-plans";

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull(),
    planId: integer("plan_id").notNull().references(() => planningPlansTable.id, { onDelete: "cascade" }),
    goalId: integer("goal_id"),
    sessionDate: date("session_date").notNull(),
    modality: text("modality").notNull(),
    title: text("title").notNull(),
    targetDurationMin: integer("target_duration_min").notNull(),
    targetIntensityRpe: numeric("target_intensity_rpe", { precision: 3, scale: 1 }),
    status: text("status").notNull().default("planned"),
    planData: jsonb("plan_data").notNull().default(sql`'{}'::jsonb`),
    resultData: jsonb("result_data").notNull().default(sql`'{}'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_sessions_user_plan_date_unique").on(table.userId, table.planId, table.sessionDate),
    index("idx_user_sessions_user_plan_date").on(table.userId, table.planId, table.sessionDate),
    index("idx_user_sessions_user_plan_status_date").on(table.userId, table.planId, table.status, table.sessionDate),
    check("user_sessions_modality_check", sql`${table.modality} in ('running', 'strength', 'fitness', 'recovery')`),
    check("user_sessions_target_duration_min_check", sql`${table.targetDurationMin} > 0`),
    check("user_sessions_target_intensity_rpe_check", sql`${table.targetIntensityRpe} between 1 and 10`),
    check("user_sessions_status_check", sql`${table.status} in ('planned', 'done', 'skipped', 'adapted')`),
  ],
);

export type UserSession = typeof userSessionsTable.$inferSelect;
export type InsertUserSession = typeof userSessionsTable.$inferInsert;
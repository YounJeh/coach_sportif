import { pgTable, serial, text, timestamp, unique, index } from "drizzle-orm/pg-core";

export const planningPlansTable = pgTable(
  "planning_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("planning_plans_user_name_unique").on(table.userId, table.name),
    index("idx_planning_plans_user_created").on(table.userId, table.createdAt),
  ],
);

export type PlanningPlan = typeof planningPlansTable.$inferSelect;
export type InsertPlanningPlan = typeof planningPlansTable.$inferInsert;

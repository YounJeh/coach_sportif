import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";

// Test : récupérer le premier workout
// console.log("Schema keys:", Object.keys(schema));
// console.log("workouts:", schema.workouts);
// const workouts = await db.select().from(schema.workoutsTable).limit(1);

// console.log("Premier workout :", workouts[0]);

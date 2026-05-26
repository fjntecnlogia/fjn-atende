import { Pool } from "pg";
import { config } from "../config";

export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
});

db.on("error", (err) => console.error("Postgres pool error:", err));

export async function shutdownDb() {
  await db.end();
}

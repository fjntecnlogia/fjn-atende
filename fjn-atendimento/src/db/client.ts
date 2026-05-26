import { Pool } from "pg";
import { config } from "../config";

export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

db.on("error", (err) => {
  console.error("Erro no pool do Postgres:", err);
});

export async function shutdownDb() {
  await db.end();
}

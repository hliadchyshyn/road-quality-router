import postgres from 'postgres'
import { config } from '../config.js'

export const sql = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: postgres.camel,  // snake_case columns → camelCase JS
})

export async function checkDbConnection(): Promise<void> {
  await sql`SELECT 1`
}

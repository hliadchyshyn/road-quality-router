import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATABASE_URL = process.env.DATABASE_URL!

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1 })

async function migrate() {
  // Ensure the migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  const migrationsDir = join(__dirname, '../src/db/migrations')

  const allFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  // Fetch already-applied migration filenames
  const applied = await sql<{ filename: string }[]>`
    SELECT filename FROM _migrations
  `
  const appliedSet = new Set(applied.map((r) => r.filename))

  const pending = allFiles.filter((f) => !appliedSet.has(f))

  console.log(`Found ${allFiles.length} migration(s), ${pending.length} pending: ${pending.join(', ') || '(none)'}`)

  for (const file of pending) {
    const migrationSql = readFileSync(join(migrationsDir, file), 'utf8')
    await sql.begin(async (txSql) => {
      await txSql.unsafe(migrationSql)
      await txSql.unsafe(`INSERT INTO _migrations (filename) VALUES ($1)`, [file])
    })
    console.log(`  ✓ ${file}`)
  }

  if (pending.length === 0) {
    console.log('All migrations already applied.')
  } else {
    console.log('All migrations applied successfully.')
  }
  await sql.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

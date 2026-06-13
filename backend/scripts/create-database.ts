/**
 * Creates a dedicated application database on the configured Postgres server.
 *
 * Connects using DATABASE_URL (to whatever database it currently points at),
 * then issues CREATE DATABASE for NEW_DB_NAME if it does not already exist.
 * Postgres has no "CREATE DATABASE IF NOT EXISTS", so we check pg_database first.
 */
import 'dotenv/config';
import { Client } from 'pg';

const NEW_DB_NAME = process.env.NEW_DB_NAME ?? 'dipanix';

function stripSslMode(url: string): string {
  return url.replace(/[?&]sslmode=[^&]*/g, '');
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  // Validate the target name — it is interpolated into DDL, so allow only
  // safe identifier characters.
  if (!/^[a-z_][a-z0-9_]*$/.test(NEW_DB_NAME)) {
    throw new Error(`Invalid database name: ${NEW_DB_NAME}`);
  }

  const client = new Client({
    connectionString: stripSslMode(url),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [NEW_DB_NAME]);
  if (exists.rowCount && exists.rowCount > 0) {
    console.log(`Database "${NEW_DB_NAME}" already exists — nothing to do.`);
  } else {
    await client.query(`CREATE DATABASE "${NEW_DB_NAME}"`);
    console.log(`Created database "${NEW_DB_NAME}".`);
  }

  await client.end();

  const target = new URL(url);
  target.pathname = `/${NEW_DB_NAME}`;
  console.log('\nPoint DATABASE_URL at:\n' + target.toString());
}

main().catch((e) => {
  console.error('Failed to create database:', e.message);
  process.exit(1);
});

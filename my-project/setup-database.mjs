#!/usr/bin/env node
// =============================================================================
// PackageBackEnd - Database Setup Script
// =============================================================================
// This script applies the database migration to your Supabase PostgreSQL.
//
// Usage:
//   node setup-database.mjs <database-url>
//
// You can find your database URL in the Supabase Dashboard:
//   Project Settings > Database > Connection string > URI
//
// Example:
//   node setup-database.mjs "postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
// =============================================================================

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('\nERROR: Database URL is required.\n');
  console.error('Usage: node setup-database.mjs <database-url>\n');
  console.error('Find your database URL in Supabase Dashboard:');
  console.error('  Project Settings > Database > Connection string > URI\n');
  console.error('Or set DATABASE_URL environment variable.\n');
  process.exit(1);
}

async function main() {
  console.log('\n=== PackageBackEnd Database Setup ===\n');

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('ERROR: Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('Migration file loaded:', migrationPath);
  console.log('SQL length:', sql.length, 'characters\n');

  console.log('Connecting to database...');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected successfully!\n');

    console.log('Applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully!\n');

    // Verify tables
    console.log('Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = result.rows.map(r => r.table_name);
    const expected = ['clinics', 'notes', 'profiles', 'sync_queue', 'training_completions'];

    console.log('Tables found:', tables.join(', '));

    const missing = expected.filter(t => !tables.includes(t));
    if (missing.length === 0) {
      console.log('\nAll required tables exist!\n');
    } else {
      console.error('\nMissing tables:', missing.join(', '));
    }

    // Verify RLS
    console.log('Verifying RLS policies...');
    const rlsResult = await client.query(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    console.log('RLS policies found:');
    for (const row of rlsResult.rows) {
      console.log('  ', row.tablename, '-', row.policyname);
    }

    // Verify RLS is enabled
    const rlsEnabled = await client.query(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND relkind = 'r'
      ORDER BY relname;
    `);

    console.log('\nRLS enabled status:');
    for (const row of rlsEnabled.rows) {
      console.log('  ', row.relname, '-', row.relrowsecurity ? 'ENABLED' : 'DISABLED');
    }

    console.log('\n=== Setup Complete ===\n');

  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.message.includes('already exists')) {
      console.log('\nNote: Some objects already exist. This may be OK if the migration was partially applied.');
      console.log('The schema may already be set up correctly.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

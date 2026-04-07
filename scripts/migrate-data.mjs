/**
 * CWT CRM - Data Migration Script
 *
 * Fetches all data from the old Lovable Supabase project and inserts
 * it into the new Supabase project using the service role key.
 *
 * Usage:
 *   node scripts/migrate-data.mjs <your-crm-email> <your-crm-password>
 */

import { createClient } from '@supabase/supabase-js';

// ── Old project (Lovable-created) ────────────────────────────
const OLD_URL = 'https://vireyckcatujwqjnoxbp.supabase.co';
const OLD_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcmV5Y2tjYXR1andxam5veGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTE5NjIsImV4cCI6MjA4NTE4Nzk2Mn0.XMT6QK-OKgU-xcOXzWTtMPftKPHzmSKFZppyykPOnXw';

// ── New project (your Supabase) ──────────────────────────────
const NEW_URL = 'https://eephssopftcicfsbggql.supabase.co';
const NEW_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlcGhzc29wZnRjaWNmc2JnZ3FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU2ODIzMiwiZXhwIjoyMDkxMTQ0MjMyfQ.LuEh4TX_wr2EG3QyJin72mViSzyVaLP9Nyhx1MHJc8o';

const TABLES = ['product_models', 'orders', 'prospects', 'allowed_emails'];

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node scripts/migrate-data.mjs <email> <password>');
    process.exit(1);
  }

  const oldClient = createClient(OLD_URL, OLD_ANON_KEY);
  const newClient = createClient(NEW_URL, NEW_SERVICE_ROLE_KEY);

  // Sign in to old project with CRM credentials
  console.log(`\nSigning in to old project as ${email}...`);
  const { error: authError } = await oldClient.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('Authentication failed:', authError.message);
    process.exit(1);
  }
  console.log('Authenticated successfully.\n');

  let totalMigrated = 0;

  for (const table of TABLES) {
    process.stdout.write(`Fetching ${table}... `);

    const { data, error: fetchError } = await oldClient.from(table).select('*');

    if (fetchError) {
      console.log(`SKIPPED (${fetchError.message})`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log('empty, nothing to migrate.');
      continue;
    }

    console.log(`${data.length} rows found. Inserting...`);

    // Insert in batches of 100 to avoid payload limits
    const BATCH = 100;
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);
      const { error: insertError } = await newClient
        .from(table)
        .insert(batch);

      if (insertError) {
        console.error(`  ✗ Batch ${i / BATCH + 1} failed: ${insertError.message}`);
      } else {
        console.log(`  ✓ Inserted rows ${i + 1}–${Math.min(i + BATCH, data.length)}`);
        totalMigrated += batch.length;
      }
    }
  }

  console.log(`\nDone. ${totalMigrated} rows migrated total.`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

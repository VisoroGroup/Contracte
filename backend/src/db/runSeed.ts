#!/usr/bin/env node
/**
 * Standalone seed runner — run from project root:
 * node_modules/.bin/tsx backend/src/db/runSeed.ts
 */
import { seed } from './seeds/initial';
import db from './index';
import path from 'path';

// Run migrations first
async function main() {
  console.log('Running migrations...');
  const isCompiled = __dirname.includes('dist');
  await db.migrate.latest({
    directory: path.join(__dirname, 'migrations'),
    extension: isCompiled ? 'js' : 'ts',
    loadExtensions: isCompiled ? ['.js'] : ['.ts'],
  });
  console.log('✅ Migrations complete');

  console.log('Running seeds...');
  await seed(db);
  console.log('✅ Seeding complete');

  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

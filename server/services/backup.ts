/**
 * Daily database backups: a consistent copy of the SQLite file (VACUUM INTO, safe while the app runs)
 * in a "backups" folder next to the database, one per day, keeping the newest `keep`.
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../db';

export function backupDaily(db: Db, dir: string, now = new Date(), keep = 7): string | null {
  mkdirSync(dir, { recursive: true });
  const name = `waypoint-${now.toISOString().slice(0, 10)}.db`;
  const existing = readdirSync(dir).filter((f) => /^waypoint-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  let made: string | null = null;
  if (!existing.includes(name)) {
    db.run('VACUUM INTO ?', join(dir, name));
    existing.push(name);
    existing.sort();
    made = name;
  }
  for (const old of existing.slice(0, Math.max(0, existing.length - keep))) rmSync(join(dir, old), { force: true });
  return made;
}

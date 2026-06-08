/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AppDataSource } from '../data-source';

/**
 * Offsite-export helper for the `pre_v1_data_backup_v1` table created by
 * the T-PRE-2 migration of the `accounts-to-modular-finance` v1.0.0
 * refactor.
 *
 * Why: the DB-side backup IS the primary safety net, but Railway's blast
 * radius (or a bad migration we haven't yet run) could in theory also lose
 * THIS table. Dumping the rows to local disk gives us an out-of-band copy
 * that lives wherever you run this script.
 *
 * Output: one JSON file per `(userId, tableName)` row at
 * `./backups/v1.0.0-pre-migration/<userId>__<tableName>__<isoUtc>.json`.
 *
 * File shape (per row):
 *   {
 *     "userId": "...",
 *     "tableName": "transactions" | "accounts",
 *     "capturedAt": "...",
 *     "rowCount": N,
 *     "rows": [ <original row objects> ]
 *   }
 *
 * Exit codes: 0 success, 1 audited the table and found 0 rows (the
 * migration probably hasn't run yet, or backup was already dropped), 2
 * unexpected error.
 *
 * Run with: `pnpm migration:export-pre-v1-backup`
 */

interface BackupRow {
  userId: string;
  tableName: string;
  capturedAt: Date;
  rowCount: number;
  rowsJson: unknown[];
}

const OUTPUT_DIR = join(process.cwd(), 'backups', 'v1.0.0-pre-migration');

function isoForFilename(d: Date): string {
  // Replace colons (illegal on Windows file paths) with hyphens; drop the
  // milliseconds since they don't add disambiguation value here.
  return d
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/\.\d+Z$/, 'Z');
}

async function exportPreV1Backup() {
  await AppDataSource.initialize();

  try {
    const rows: BackupRow[] = await AppDataSource.query(`
      SELECT
        "userId",
        "tableName",
        "capturedAt",
        "rowCount",
        "rowsJson"
      FROM "pre_v1_data_backup_v1"
      ORDER BY "userId", "tableName"
    `);

    if (rows.length === 0) {
      console.error(
        '⚠️  pre_v1_data_backup_v1 is empty (0 rows). ' +
          'Has the T-PRE-2 migration (1741000027000) run yet? ' +
          'Has the backup table been manually dropped after v1.0.0 stable?',
      );
      process.exit(1);
    }

    await mkdir(OUTPUT_DIR, { recursive: true });

    const writtenFiles: string[] = [];
    for (const row of rows) {
      const capturedAtIso = isoForFilename(new Date(row.capturedAt));
      const fileName = `${row.userId}__${row.tableName}__${capturedAtIso}.json`;
      const filePath = join(OUTPUT_DIR, fileName);
      const payload = {
        userId: row.userId,
        tableName: row.tableName,
        capturedAt: row.capturedAt,
        rowCount: row.rowCount,
        rows: row.rowsJson,
      };
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
      writtenFiles.push(filePath);
    }

    console.error(`✅ Wrote ${writtenFiles.length} backup file(s) to ${OUTPUT_DIR}:`);
    for (const f of writtenFiles) {
      console.error(`   • ${f}`);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed unexpectedly:', error);
    process.exit(2);
  } finally {
    await AppDataSource.destroy();
  }
}

exportPreV1Backup();

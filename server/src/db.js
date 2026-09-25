import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(here, '..', process.env.DATABASE_PATH || './data/ajuste.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  const migrationDir = path.resolve(here, '..', 'migrations');
  const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort();
  const applied = db.prepare('SELECT 1 FROM migrations WHERE name = ?');
  const apply = db.transaction((file) => {
    db.exec(fs.readFileSync(path.join(migrationDir, file), 'utf8'));
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
  });
  for (const file of files) if (!applied.get(file)) apply(file);
}

export const defaultSettings = {
  mnqTickSize: '0.25', mnqTickValue: '0.50', ustecValuePerPoint: '1.00',
  lotStep: '0.01', minLot: '0.01', maxLot: '100.00', locale: 'pt-BR', currency: 'USD',
};

export function getSettings(userId) {
  const instrument = db.prepare('SELECT * FROM instrument_settings WHERE user_id = ?').get(userId);
  const broker = db.prepare('SELECT * FROM broker_settings WHERE user_id = ?').get(userId);
  return instrument && broker ? {
    mnqTickSize: instrument.mnq_tick_size, mnqTickValue: instrument.mnq_tick_value,
    ustecValuePerPoint: instrument.ustec_value_per_point, lotStep: broker.lot_step,
    minLot: broker.min_lot, maxLot: broker.max_lot, locale: broker.locale, currency: broker.currency,
  } : defaultSettings;
}

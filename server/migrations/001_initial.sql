CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instrument_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mnq_tick_size TEXT NOT NULL DEFAULT '0.25',
  mnq_tick_value TEXT NOT NULL DEFAULT '0.50',
  ustec_value_per_point TEXT NOT NULL DEFAULT '1.00'
);

CREATE TABLE IF NOT EXISTS broker_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  lot_step TEXT NOT NULL DEFAULT '0.01',
  min_lot TEXT NOT NULL DEFAULT '0.01',
  max_lot TEXT NOT NULL DEFAULT '100.00',
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  currency TEXT NOT NULL DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  mesa_contracts INTEGER NOT NULL CHECK(mesa_contracts >= 0),
  real_lots TEXT NOT NULL,
  take_ticks INTEGER NOT NULL CHECK(take_ticks > 0),
  stop_ticks INTEGER NOT NULL CHECK(stop_ticks > 0),
  mesa_take TEXT NOT NULL, mesa_stop TEXT NOT NULL,
  real_take TEXT NOT NULL, real_stop TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANEJADA',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_field TEXT NOT NULL,
  target_value TEXT NOT NULL,
  realized_value TEXT NOT NULL,
  balance TEXT NOT NULL,
  market TEXT NOT NULL,
  mode TEXT NOT NULL,
  suggested_quantity TEXT NOT NULL,
  suggested_ticks INTEGER NOT NULL,
  predicted_result TEXT NOT NULL,
  difference TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_operation ON adjustments(operation_id);


CREATE TABLE transactions (
    invoice_no VARCHAR(20),
    stock_code VARCHAR(20),
    description TEXT,
    quantity INTEGER,
    invoice_date TIMESTAMP,
    unit_price NUMERIC(12, 2),
    customer_id INTEGER,
    country VARCHAR(100),
    revenue NUMERIC(14, 2),
    is_cancellation BOOLEAN
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(320) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_transactions (
    id BIGSERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL,
    customer_id TEXT,
    description TEXT,
    quantity NUMERIC(18, 4) NOT NULL,
    invoice_date TIMESTAMP NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    country TEXT,
    revenue NUMERIC(20, 4) NOT NULL,
    is_cancellation BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_settings (
    owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    workspace_name VARCHAR(120) NOT NULL DEFAULT 'Analytics workspace',
    currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

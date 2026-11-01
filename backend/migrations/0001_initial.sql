CREATE TABLE IF NOT EXISTS records (
    id VARCHAR NOT NULL PRIMARY KEY,
    kind VARCHAR NOT NULL,
    body TEXT NOT NULL,
    updated VARCHAR NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_records_kind ON records (kind);
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR NOT NULL PRIMARY KEY,
    release VARCHAR NOT NULL,
    session VARCHAR NOT NULL,
    checkout_key VARCHAR NOT NULL,
    total_cents INTEGER NOT NULL,
    created VARCHAR NOT NULL,
    CONSTRAINT uq_order_checkout UNIQUE (release, session, checkout_key)
);
CREATE INDEX IF NOT EXISTS ix_orders_session ON orders (session);

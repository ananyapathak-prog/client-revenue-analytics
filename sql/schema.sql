
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

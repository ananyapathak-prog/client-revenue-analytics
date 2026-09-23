
-- =========================================================
-- 1. MONTHLY REVENUE
-- =========================================================

SELECT
    DATE_TRUNC('month', invoice_date) AS month,
    SUM(revenue) AS net_revenue
FROM transactions
GROUP BY month
ORDER BY month;

-- =========================================================
-- 2. MONTHLY GROSS REVENUE
-- =========================================================

SELECT
    DATE_TRUNC('month', invoice_date) AS month,
    SUM(revenue) AS gross_revenue
FROM transactions
WHERE is_cancellation = FALSE
GROUP BY month
ORDER BY month;

-- =========================================================
-- 3. CUSTOMER SEGMENTATION
-- =========================================================

SELECT
    customer_type,
    COUNT(*) AS customer_count,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (),
        2
    ) AS percentage
FROM (
    SELECT
        customer_id,
        CASE
            WHEN COUNT(DISTINCT invoice_no) = 1 THEN 'One-time'
            ELSE 'Repeat'
        END AS customer_type
    FROM transactions
    WHERE customer_id IS NOT NULL
      AND is_cancellation = FALSE
    GROUP BY customer_id
) AS customer_segments
GROUP BY customer_type;

-- =========================================================
-- 4. AVERAGE ORDER VALUE
-- =========================================================

SELECT
    AVG(order_revenue) AS average_order_value
FROM (
    SELECT
        invoice_no,
        SUM(revenue) AS order_revenue
    FROM transactions
    WHERE is_cancellation = FALSE
    GROUP BY invoice_no
) AS orders;

-- =========================================================
-- 5. CUSTOMER COHORTS
-- =========================================================

WITH customer_cohorts AS (
    SELECT
        customer_id,
        DATE_TRUNC('month', MIN(invoice_date)) AS first_purchase_month
    FROM transactions
    WHERE customer_id IS NOT NULL
      AND is_cancellation = FALSE
    GROUP BY customer_id
)

SELECT *
FROM customer_cohorts
ORDER BY first_purchase_month;

-- =========================================================
-- 6. CUSTOMER PURCHASE MONTHS
-- =========================================================

SELECT DISTINCT
    customer_id,
    DATE_TRUNC('month', invoice_date) AS purchase_month
FROM transactions
WHERE customer_id IS NOT NULL
  AND is_cancellation = FALSE
ORDER BY customer_id, purchase_month;

-- =========================================================
-- 7. MONTH NUMBER SINCE FIRST PURCHASE
-- =========================================================

WITH customer_cohorts AS (
    SELECT
        customer_id,
        DATE_TRUNC('month', MIN(invoice_date)) AS first_purchase_month
    FROM transactions
    WHERE customer_id IS NOT NULL
      AND is_cancellation = FALSE
    GROUP BY customer_id
),

customer_activity AS (
    SELECT DISTINCT
        customer_id,
        DATE_TRUNC('month', invoice_date) AS purchase_month
    FROM transactions
    WHERE customer_id IS NOT NULL
      AND is_cancellation = FALSE
)

SELECT
    c.customer_id,
    c.first_purchase_month,
    p.purchase_month,

    (
        (EXTRACT(YEAR FROM p.purchase_month) -
         EXTRACT(YEAR FROM c.first_purchase_month)) * 12
        +
        (EXTRACT(MONTH FROM p.purchase_month) -
         EXTRACT(MONTH FROM c.first_purchase_month))
    ) AS month_number

FROM customer_cohorts c
JOIN customer_activity p
    ON c.customer_id = p.customer_id

ORDER BY c.customer_id, p.purchase_month;

-- =========================================================
-- 8. COHORT RETENTION COUNTS
-- =========================================================

WITH customer_cohorts AS (
    SELECT
        customer_id,
        DATE_TRUNC('month', MIN(invoice_date)) AS first_purchase_month
    FROM transactions
    WHERE customer_id IS NOT NULL
      AND is_cancellation = FALSE
    GROUP BY customer_id
),

customer_activity AS (
    SELECT DISTINCT
        customer_id,
        DATE_TRUNC('month', invoice_date) AS purchase_month
    FROM transactions
    WHERE customer_id IS NOT NULL
      AND is_cancellation = FALSE
),

cohort_activity AS (
    SELECT
        c.customer_id,
        c.first_purchase_month,
        p.purchase_month,

        (
            (EXTRACT(YEAR FROM p.purchase_month) -
             EXTRACT(YEAR FROM c.first_purchase_month)) * 12
            +
            (EXTRACT(MONTH FROM p.purchase_month) -
             EXTRACT(MONTH FROM c.first_purchase_month))
        ) AS month_number

    FROM customer_cohorts c
    JOIN customer_activity p
        ON c.customer_id = p.customer_id
)

SELECT
    first_purchase_month,
    month_number,
    COUNT(DISTINCT customer_id) AS active_customers

FROM cohort_activity

GROUP BY first_purchase_month, month_number
ORDER BY first_purchase_month, month_number;

-- =========================================================
-- 9. COHORT RETENTION PERCENTAGES
-- =========================================================

WITH retention AS (
    WITH customer_cohorts AS (
        SELECT
            customer_id,
            DATE_TRUNC('month', MIN(invoice_date))
                AS first_purchase_month
        FROM transactions
        WHERE customer_id IS NOT NULL
          AND is_cancellation = FALSE
        GROUP BY customer_id
    ),

    customer_activity AS (
        SELECT DISTINCT
            customer_id,
            DATE_TRUNC('month', invoice_date)
                AS purchase_month
        FROM transactions
        WHERE customer_id IS NOT NULL
          AND is_cancellation = FALSE
    )

    SELECT
        c.customer_id,
        c.first_purchase_month,
        (
            (EXTRACT(YEAR FROM p.purchase_month) -
             EXTRACT(YEAR FROM c.first_purchase_month)) * 12
            +
            (EXTRACT(MONTH FROM p.purchase_month) -
             EXTRACT(MONTH FROM c.first_purchase_month))
        ) AS month_number
    FROM customer_cohorts c
    JOIN customer_activity p
        ON c.customer_id = p.customer_id
),

cohort_counts AS (
    SELECT
        first_purchase_month,
        month_number,
        COUNT(DISTINCT customer_id) AS active_customers
    FROM retention
    GROUP BY first_purchase_month, month_number
)

SELECT
    first_purchase_month,
    month_number,
    active_customers,

    ROUND(
        active_customers * 100.0 /
        FIRST_VALUE(active_customers) OVER (
            PARTITION BY first_purchase_month
            ORDER BY month_number
        ),
        2
    ) AS retention_percentage

FROM cohort_counts
ORDER BY first_purchase_month, month_number;

-- =========================================================
-- 10. COHORT RETENTION MATRIX
-- =========================================================

WITH retention AS (
    SELECT
        c.customer_id,
        c.first_purchase_month,
        (
            (EXTRACT(YEAR FROM p.purchase_month) -
             EXTRACT(YEAR FROM c.first_purchase_month)) * 12
            +
            (EXTRACT(MONTH FROM p.purchase_month) -
             EXTRACT(MONTH FROM c.first_purchase_month))
        ) AS month_number
    FROM (
        SELECT
            customer_id,
            DATE_TRUNC('month', MIN(invoice_date))
                AS first_purchase_month
        FROM transactions
        WHERE customer_id IS NOT NULL
          AND is_cancellation = FALSE
        GROUP BY customer_id
    ) c
    JOIN (
        SELECT DISTINCT
            customer_id,
            DATE_TRUNC('month', invoice_date)
                AS purchase_month
        FROM transactions
        WHERE customer_id IS NOT NULL
          AND is_cancellation = FALSE
    ) p
        ON c.customer_id = p.customer_id
),

cohort_counts AS (
    SELECT
        first_purchase_month,
        month_number,
        COUNT(DISTINCT customer_id) AS active_customers
    FROM retention
    GROUP BY first_purchase_month, month_number
)

SELECT
    first_purchase_month,

    ROUND(
        MAX(CASE WHEN month_number = 0
            THEN active_customers END) * 100.0 /
        MAX(CASE WHEN month_number = 0
            THEN active_customers END), 2
    ) AS m0,

    ROUND(
        MAX(CASE WHEN month_number = 1
            THEN active_customers END) * 100.0 /
        MAX(CASE WHEN month_number = 0
            THEN active_customers END), 2
    ) AS m1,

    ROUND(
        MAX(CASE WHEN month_number = 2
            THEN active_customers END) * 100.0 /
        MAX(CASE WHEN month_number = 0
            THEN active_customers END), 2
    ) AS m2,

    ROUND(
        MAX(CASE WHEN month_number = 3
            THEN active_customers END) * 100.0 /
        MAX(CASE WHEN month_number = 0
            THEN active_customers END), 2
    ) AS m3

FROM cohort_counts
GROUP BY first_purchase_month
ORDER BY first_purchase_month;


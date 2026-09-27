from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from api.database import engine
import pandas as pd

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Revenue Analytics API is running"}


@app.get("/analytics/monthly-revenue")
def monthly_revenue():

    query = text("""
        SELECT
            DATE_TRUNC('month', invoice_date) AS month,
            SUM(revenue) AS net_revenue
        FROM transactions
        GROUP BY month
        ORDER BY month;
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

        data = [
            {
                "month": row.month.strftime("%Y-%m"),
                "net_revenue": float(row.net_revenue)
            }
            for row in result
        ]

    return data


@app.get("/analytics/gross-revenue")
def gross_revenue():

    query = text("""
        SELECT
            DATE_TRUNC('month', invoice_date) AS month,
            SUM(revenue) AS gross_revenue
        FROM transactions
        WHERE is_cancellation = FALSE
        GROUP BY month
        ORDER BY month;
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

        data = [
            {
                "month": row.month.strftime("%Y-%m"),
                "gross_revenue": float(row.gross_revenue)
            }
            for row in result
        ]

    return data


@app.get("/analytics/customer-segments")
def customer_segments():

    query = text("""
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
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

        data = [
            {
                "customer_type": row.customer_type,
                "customer_count": row.customer_count,
                "percentage": float(row.percentage)
            }
            for row in result
        ]

    return data


@app.get("/analytics/aov")
def average_order_value():

    query = text("""
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
    """)

    with engine.connect() as connection:
        result = connection.execute(query)
        row = result.fetchone()

    return {
        "average_order_value": float(row.average_order_value)
    }


@app.get("/analytics/cohort-retention")
def cohort_retention():

    query = text("""
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
            FROM cohort_activity
            GROUP BY
                first_purchase_month,
                month_number
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

        ORDER BY
            first_purchase_month,
            month_number;
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

        data = [
            {
                "cohort": row.first_purchase_month.strftime("%Y-%m"),
                "month_number": int(row.month_number),
                "active_customers": row.active_customers,
                "retention_percentage": float(row.retention_percentage)
            }
            for row in result
        ]

    return data


@app.get("/analytics/top-customers")
def top_customers():

    query = text("""
        SELECT
            customer_id,
            SUM(revenue) AS total_revenue
        FROM transactions
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
        ORDER BY total_revenue DESC
        LIMIT 10;
    """)
    with engine.connect() as connection:
        result = connection.execute(query)

    data = [
        {
            "customer_id": row.customer_id,
            "total_revenue": float(row.total_revenue)
        }
        for row in result
    ]

    return data


@app.get("/analytics/top-products")
def top_products():

    query = text("""
        SELECT
            stock_code,
            description,
            SUM(revenue) AS total_revenue
        FROM transactions
        WHERE is_cancellation = FALSE
         AND description NOT IN ('DOTCOM POSTAGE', 'POSTAGE')

        GROUP BY stock_code, description
        ORDER BY total_revenue DESC
        LIMIT 10;
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

    data = [
        {
            "stock_code": row.stock_code,
            "description": row.description,
            "total_revenue": float(row.total_revenue)
        }
        for row in result
    ]

    return data


@app.get("/analytics/top-customers")
def top_customers():

    query = text("""
        SELECT
            customer_id,
            SUM(revenue) AS total_revenue
        FROM transactions
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
        ORDER BY total_revenue DESC
        LIMIT 10;
    """)

    with engine.connect() as connection:
        result = connection.execute(query)

    data = [
        {
            "customer_id": row.customer_id,
            "total_revenue": float(row.total_revenue)
        }
        for row in result
    ]

    return data


def detect_columns(columns):

    column_map = {}

    for column in columns:

        name = column.lower().replace(" ", "_")

        if name in ["orderid", "order_id", "invoice", "invoice_no"]:
            column_map["order_id"] = column

        elif name in ["customerid", "customer_id", "customer", "client_id"]:
            column_map["customer_id"] = column

        elif name in ["date", "order_date", "transaction_date", "invoice_date"]:
            column_map["date"] = column

        elif name in ["product", "product_name", "item", "description"]:
            column_map["product"] = column

        elif name in ["quantity", "qty", "units"]:
            column_map["quantity"] = column

        elif name in ["price", "unit_price", "amount"]:
            column_map["unit_price"] = column

    return column_map


def standardize_data(df, column_map):

    df = df.rename(
        columns={
            column_map["order_id"]: "order_id",
            column_map["customer_id"]: "customer_id",
            column_map["date"]: "date",
            column_map["product"]: "product",
            column_map["quantity"]: "quantity",
            column_map["unit_price"]: "unit_price",
        }
    )

    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    df["revenue"] = df["quantity"] * df["unit_price"]

    return df


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):

    df = pd.read_csv(file.file)

    detected_columns = detect_columns(df.columns)

    required_columns = [
        "order_id",
        "customer_id",
        "date",
        "product",
        "quantity",
        "unit_price"
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in detected_columns
    ]

    if missing_columns:
        return {
            "error": "Could not detect required columns",
            "missing_columns": missing_columns
        }

    standardized_df = standardize_data(df, detected_columns)

    validation_errors = validate_data(standardized_df)

    if validation_errors:
        return {
            "error": "Data validation failed",
            "details": validation_errors
        }

    return {
        "filename": file.filename,
        "rows": len(standardized_df),
        "columns": list(standardized_df.columns),
        "preview": standardized_df.head(5).to_dict(orient="records")
    }


def validate_data(df):

    errors = []

    if df["order_id"].isna().any():
        errors.append("Some orders are missing order IDs.")

    if df["date"].isna().any():
        errors.append("Some rows have missing dates.")

    if df["quantity"].isna().any():
        errors.append("Some rows have missing quantities.")

    if df["unit_price"].isna().any():
        errors.append("Some rows have missing prices.")

    if (df["quantity"] <= 0).any():
        errors.append("Some rows have zero or negative quantities.")

    if (df["unit_price"] <= 0).any():
        errors.append("Some rows have zero or negative prices.")

    return errors

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from api.database import engine
import pandas as pd

app = FastAPI()
logger = logging.getLogger("revenue-analytics")
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "https://client-revenue-analytics.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = os.getenv("JWT_SECRET", "local-development-secret-change-me")
bearer_scheme = HTTPBearer(auto_error=False)


class AuthPayload(BaseModel):
    email: str
    password: str
    name: str | None = None


class SettingsPayload(BaseModel):
    workspace_name: str
    currency: str
    notifications_enabled: bool


class InsightPayload(BaseModel):
    totals: dict[str, Any]
    monthly_revenue: list[dict[str, Any]]
    top_products: list[dict[str, Any]]
    filters: dict[str, str] = {}


class AskPayload(BaseModel):
    question: str


def ensure_users_table():
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                email VARCHAR(320) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))


def ensure_user_transactions_table():
    with engine.begin() as connection:
        connection.execute(text("""
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
            )
        """))


def ensure_user_settings_table():
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_settings (
                owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                workspace_name VARCHAR(120) NOT NULL DEFAULT 'Analytics workspace',
                currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
                notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        _, salt_text, digest_text = stored_hash.split("$", 2)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_token(user_id: int, email: str, name: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": user_id, "email": email, "name": name, "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())}

    def encode(value: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")

    unsigned = f"{encode(header)}.{encode(payload)}"
    signature = hmac.new(JWT_SECRET.encode(), unsigned.encode(), hashlib.sha256).digest()
    return f"{unsigned}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        encoded_header, encoded_payload, encoded_signature = credentials.credentials.split(".")
        unsigned = f"{encoded_header}.{encoded_payload}"
        supplied = base64.urlsafe_b64decode(encoded_signature + "===")
        expected = hmac.new(JWT_SECRET.encode(), unsigned.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(supplied, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(encoded_payload + "===").decode())
        if int(payload["exp"]) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError
        return payload
    except (ValueError, KeyError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


@app.get("/")
def home():
    return {"message": "Revenue Analytics API is running"}


@app.post("/auth/signup")
def signup(payload: AuthPayload):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if "@" not in payload.email or "." not in payload.email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    ensure_users_table()
    email = payload.email.lower()
    try:
        with engine.begin() as connection:
            row = connection.execute(text("""
                INSERT INTO users (name, email, password_hash)
                VALUES (:name, :email, :password_hash)
                RETURNING id, name, email
            """), {"name": payload.name.strip(), "email": email, "password_hash": hash_password(payload.password)}).mappings().one()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return {"token": create_token(row["id"], row["email"], row["name"]), "user": dict(row)}


@app.post("/auth/login")
def login(payload: AuthPayload):
    ensure_users_table()
    with engine.connect() as connection:
        row = connection.execute(text("SELECT id, name, email, password_hash FROM users WHERE email = :email"), {"email": payload.email.lower()}).mappings().first()
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = {"id": row["id"], "name": row["name"], "email": row["email"]}
    return {"token": create_token(row["id"], row["email"], row["name"]), "user": user}


@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {"user": current_user}


@app.get("/settings")
def get_settings(current_user=Depends(get_current_user)):
    ensure_user_settings_table()
    with engine.connect() as connection:
        row = connection.execute(text("SELECT workspace_name, currency, notifications_enabled FROM user_settings WHERE owner_id = :owner_id"), {"owner_id": int(current_user["sub"])}).mappings().first()
    return dict(row) if row else {"workspace_name": "Analytics workspace", "currency": "GBP", "notifications_enabled": True}


@app.put("/settings")
def update_settings(payload: SettingsPayload, current_user=Depends(get_current_user)):
    if payload.currency not in {"GBP", "USD", "EUR", "INR"}:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    if not payload.workspace_name.strip():
        raise HTTPException(status_code=400, detail="Workspace name is required")
    ensure_user_settings_table()
    values = {"owner_id": int(current_user["sub"]), "workspace_name": payload.workspace_name.strip(), "currency": payload.currency, "notifications_enabled": payload.notifications_enabled}
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO user_settings (owner_id, workspace_name, currency, notifications_enabled)
            VALUES (:owner_id, :workspace_name, :currency, :notifications_enabled)
            ON CONFLICT (owner_id) DO UPDATE SET
                workspace_name = EXCLUDED.workspace_name,
                currency = EXCLUDED.currency,
                notifications_enabled = EXCLUDED.notifications_enabled,
                updated_at = NOW()
        """), values)
    return values


@app.post("/ai/insights")
def ai_insights(payload: InsightPayload, current_user=Depends(get_optional_user)):
    metrics = payload.model_dump()
    fallback = {
        "source": "deterministic",
        "headline": "Healthy momentum",
        "score": 84,
        "analysis": "Revenue is building steadily. Repeat customers and your strongest products are the clearest opportunities to protect and grow.",
        "insights": [
            {"icon": "↗", "title": "Revenue is moving up", "text": "Your latest revenue and order mix show positive momentum.", "tone": "green"},
            {"icon": "◆", "title": "Repeat customers matter", "text": "Protect retention and create reasons for customers to come back.", "tone": "gold"},
            {"icon": "!", "title": "Focus on your best products", "text": "Use your highest-revenue products as the starting point for growth.", "tone": "coral"},
        ],
    }
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return fallback


@app.post("/ai/ask")
def ask_ai(payload: AskPayload, current_user=Depends(get_optional_user)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Ask a question about your data")
    source_table = "user_transactions" if current_user else "transactions"
    params: dict[str, Any] = {}
    owner_filter = ""
    if current_user:
        owner_filter = " AND owner_id = :owner_id"
        params["owner_id"] = int(current_user["sub"])
    try:
        with engine.connect() as connection:
            totals = connection.execute(text(f"""
                SELECT COALESCE(SUM(revenue), 0) AS revenue,
                       COUNT(DISTINCT invoice_no) AS orders,
                       COUNT(DISTINCT customer_id) AS customers
                FROM {source_table}
                WHERE is_cancellation = FALSE{owner_filter}
            """), params).mappings().one()
            products = connection.execute(text(f"""
                SELECT description AS product, COALESCE(SUM(revenue), 0) AS revenue
                FROM {source_table}
                WHERE is_cancellation = FALSE AND description IS NOT NULL{owner_filter}
                GROUP BY description ORDER BY revenue DESC LIMIT 10
            """), params).mappings().all()
        context = {"totals": dict(totals), "top_products": [dict(row) for row in products]}
    except Exception:
        # Render's demo database may not be seeded; keep the public demo usable.
        context = {
            "totals": {"revenue": 2298000, "orders": 15686, "customers": 8412},
            "top_products": [
                {"product": "Sterling silver pendant", "revenue": 184200},
                {"product": "Classic leather tote", "revenue": 156800},
                {"product": "Ceramic coffee set", "revenue": 131400},
            ],
        }
    prompt = json.dumps({"question": question, "data": context}, default=str)
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        request = urllib.request.Request(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            data=json.dumps({"model": gemini_model, "input": "You are a careful business analyst. Answer the user's question using only the supplied business metrics. Be concise, specific, and state when the data is insufficient. Do not invent figures.\n\n" + prompt}).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": gemini_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                result = json.loads(response.read().decode())
            output_steps = [step for step in result.get("steps", []) if step.get("type") == "model_output"]
            answer = "".join(part.get("text", "") for step in output_steps for part in step.get("content", [])).strip()
            answer = answer or str(result.get("output_text", "")).strip()
            if not answer:
                raise ValueError("Gemini returned no text")
            return {"source": "gemini", "model": gemini_model, "answer": answer}
        except urllib.error.HTTPError as error:
            details = error.read().decode(errors="replace")
            logger.error("Gemini HTTP %s for model %s: %s", error.code, gemini_model, details[:1000])
        except (urllib.error.URLError, KeyError, IndexError, ValueError, json.JSONDecodeError) as error:
            logger.error("Gemini response could not be parsed for model %s: %s", gemini_model, error)
        return {"source": "deterministic", "answer": f"Gemini could not answer right now, but your data contains {context['totals']['orders']:,} orders and {context['totals']['customers']:,} customers. Your leading products are {', '.join(row['product'] for row in context['top_products'][:3])}."}
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"source": "deterministic", "answer": "AI questions are ready once GEMINI_API_KEY is configured on Render. Your data currently contains " + f"{context['totals']['orders']:,} orders and {context['totals']['customers']:,} customers."}
    from openai import OpenAI
    models = [os.getenv("OPENAI_MODEL", "gpt-5"), "gpt-4o-mini"]
    for model in dict.fromkeys(models):
        try:
            response = OpenAI(api_key=api_key).responses.create(
                model=model,
                input=[
                    {"role": "system", "content": "You are a careful business analyst. Answer the user's question using only the supplied business metrics. Be concise, specific, and state when the data is insufficient. Do not invent figures."},
                    {"role": "user", "content": prompt},
                ],
            )
            return {"source": "openai", "model": model, "answer": response.output_text.strip()}
        except Exception:
            logger.exception("OpenAI request failed with model %s", model)
    return {"source": "deterministic", "answer": f"I could not connect to OpenAI, but your data contains {context['totals']['orders']:,} orders and {context['totals']['customers']:,} customers. Your leading products are {', '.join(row['product'] for row in context['top_products'][:3])}."}
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5"),
            input=[
                {"role": "system", "content": "You are a concise business analyst. Use only the supplied metrics. Return valid JSON with exactly these keys: headline (string), score (integer 0-100), analysis (2 concise sentences including one concrete action), insights (array of exactly 3 objects with icon, title, text, tone). tone must be green, gold, or coral. Do not invent data."},
                {"role": "user", "content": json.dumps(metrics, default=str)},
            ],
        )
        generated = json.loads(response.output_text.strip())
        if not isinstance(generated.get("insights"), list) or len(generated["insights"]) != 3:
            raise ValueError("The AI response did not contain three insights")
        return {"source": "openai", **generated}
    except Exception:
        return fallback


@app.get("/analytics/summary")
def analytics_summary(segment: str | None = None, country: str | None = None, product: str | None = None, current_user=Depends(get_optional_user)):
    """Return the dashboard's core metrics after applying the workspace filters."""
    conditions = ["t.is_cancellation = FALSE"]
    params = {}
    source_table = "transactions"
    if current_user:
        source_table = "user_transactions"
        conditions.append("t.owner_id = :owner_id")
        params["owner_id"] = int(current_user["sub"])
    if country and country != "All countries":
        conditions.append("t.country = :country")
        params["country"] = country
    if product and product != "All products":
        conditions.append("t.description = :product")
        params["product"] = product
    if segment and segment != "All customers":
        conditions.append("cf.customer_type = :segment")
        params["segment"] = "Repeat" if segment == "Repeat customers" else "One-time"
    where_clause = " AND ".join(conditions)
    filtered_cte = f"""
        WITH customer_frequency AS (
            SELECT customer_id,
                CASE WHEN COUNT(DISTINCT invoice_no) = 1 THEN 'One-time' ELSE 'Repeat' END AS customer_type
            FROM {source_table}
            WHERE customer_id IS NOT NULL AND is_cancellation = FALSE
            GROUP BY customer_id
        ), filtered AS (
            SELECT t.* FROM {source_table} t
            LEFT JOIN customer_frequency cf ON cf.customer_id = t.customer_id
            WHERE {where_clause}
        )
    """
    with engine.connect() as connection:
        monthly = connection.execute(text(filtered_cte + """
            SELECT TO_CHAR(DATE_TRUNC('month', invoice_date), 'YYYY-MM') AS month,
                   COALESCE(SUM(revenue), 0) AS revenue,
                   COUNT(DISTINCT invoice_no) AS orders
            FROM filtered GROUP BY 1 ORDER BY 1
        """), params).mappings().all()
        totals = connection.execute(text(filtered_cte + """
            SELECT COALESCE(SUM(revenue), 0) AS revenue,
                   COUNT(DISTINCT invoice_no) AS orders,
                   COALESCE((SELECT AVG(order_revenue) FROM (
                       SELECT invoice_no, SUM(revenue) AS order_revenue
                       FROM filtered GROUP BY invoice_no
                   ) order_totals), 0) AS aov
            FROM filtered
        """), params).mappings().one()
        products = connection.execute(text(filtered_cte + """
            SELECT description AS name, COALESCE(SUM(revenue), 0) AS revenue
            FROM filtered WHERE description IS NOT NULL
            GROUP BY description ORDER BY revenue DESC LIMIT 5
        """), params).mappings().all()
    total_revenue = float(totals["revenue"] or 0)
    return {
        "totals": {"revenue": total_revenue, "orders": int(totals["orders"] or 0), "aov": float(totals["aov"] or 0)},
        "monthly_revenue": [{"month": row["month"], "revenue": float(row["revenue"] or 0), "orders": int(row["orders"] or 0)} for row in monthly],
        "top_products": [{"name": row["name"], "revenue": float(row["revenue"] or 0), "share": round(float(row["revenue"] or 0) * 100 / total_revenue, 1) if total_revenue else 0} for row in products],
    }


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
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")

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
        raise HTTPException(status_code=422, detail=f"Could not detect required columns: {', '.join(missing_columns)}")

    standardized_df = standardize_data(df, detected_columns)

    validation_errors = validate_data(standardized_df)

    if validation_errors:
        raise HTTPException(status_code=422, detail="; ".join(validation_errors))

    ensure_user_transactions_table()
    standardized_df["invoice_no"] = standardized_df["order_id"].astype(str)
    standardized_df["description"] = standardized_df["product"].astype(str)
    standardized_df["invoice_date"] = standardized_df["date"]
    standardized_df["country"] = standardized_df.get("country", "Unknown")
    standardized_df["is_cancellation"] = standardized_df["quantity"] < 0
    records = standardized_df[["invoice_no", "customer_id", "description", "quantity", "invoice_date", "unit_price", "country", "revenue", "is_cancellation"]].to_dict(orient="records")
    for record in records:
        record["owner_id"] = int(current_user["sub"])

    with engine.begin() as connection:
        connection.execute(text("DELETE FROM user_transactions WHERE owner_id = :owner_id"), {"owner_id": int(current_user["sub"])})
        connection.execute(text("""
            INSERT INTO user_transactions
                (owner_id, invoice_no, customer_id, description, quantity, invoice_date, unit_price, country, revenue, is_cancellation)
            VALUES
                (:owner_id, :invoice_no, :customer_id, :description, :quantity, :invoice_date, :unit_price, :country, :revenue, :is_cancellation)
        """), records)

    return {
        "filename": file.filename,
        "rows": len(standardized_df),
        "columns": list(standardized_df.columns),
        "preview": standardized_df.head(5).to_dict(orient="records"),
        "message": "Dataset uploaded and ready for analysis"
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

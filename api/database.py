
from sqlalchemy import create_engine

DATABASE_URL = "postgresql+psycopg2://localhost:5432/revenue_analytics"

engine = create_engine(DATABASE_URL)

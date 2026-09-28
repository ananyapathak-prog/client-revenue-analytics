
# Client Revenue Analytics Pipeline & Dashboard

An end-to-end analytics platform that transforms retail transaction data into business insights through a Python ETL pipeline, PostgreSQL analytics, FastAPI services, and an interactive React dashboard.

## Project Overview

This project simulates a client analytics engagement where raw transaction data is transformed into actionable revenue, customer, product, and retention insights.

The system follows a complete data-to-dashboard workflow:

Raw Dataset → Python ETL → PostgreSQL → SQL Analytics → FastAPI → React Dashboard

## Key Features

- Python-based data extraction and cleaning
- PostgreSQL data warehouse
- Analytical SQL queries using:
  - CTEs
  - Window functions
  - Aggregations
  - Cohort analysis
  - Customer segmentation
- FastAPI backend exposing analytics endpoints
- React + TypeScript dashboard
- Tailwind CSS for UI
- Recharts for data visualization
- Customer retention and cohort analysis
- Revenue and customer KPIs

## Analytics

The project currently analyzes:

- Monthly net revenue
- Monthly gross revenue
- Average order value
- Repeat vs one-time customers
- Customer cohorts
- Cohort retention
- Top customers
- Top products

## Tech Stack

| Layer | Technology |
|---|---|
| Data Processing | Python, Pandas |
| Database | PostgreSQL |
| Backend | FastAPI |
| Frontend | React, TypeScript |
| Styling | Tailwind CSS |
| Visualization | Recharts |
| ORM / Database Connection | SQLAlchemy |
| Version Control | Git, GitHub |

## Project Structure

```text
client-revenue-analytics/
│
├── api/
│   ├── database.py
│   └── main.py
│
├── dashboard/
│   ├── src/
│   └── package.json
│
├── data/
│   └── processed/
│
├── etl/
│   ├── extract.py
│   └── transform.py
│
├── sql/
│   ├── analytics.sql
│   └── schema.sql
│
├── requirements.txt
└── README.md
```

## Deployment

The repository includes `render.yaml` for the FastAPI service and PostgreSQL database, plus `dashboard/vercel.json` for the Vite frontend.

### Render backend

1. Create a new Blueprint on Render from this GitHub repository.
2. Select `render.yaml` when prompted.
3. Copy the API URL after the service is created, such as `https://client-revenue-analytics-api.onrender.com`.
4. Set the Render `FRONTEND_URL` value to the deployed Vercel URL.

### Vercel frontend

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `dashboard`.
3. Add `VITE_API_URL` with the Render API URL.
4. Deploy the project.

The backend uses `DATABASE_URL` and `JWT_SECRET` from the deployment environment. Do not commit `.env`; use `.env.example` as the local template.

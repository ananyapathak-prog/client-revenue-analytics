
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
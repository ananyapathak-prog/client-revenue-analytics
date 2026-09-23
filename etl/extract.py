import pandas as pd

file_path = "data/raw/Online Retail.xlsx"

df = pd.read_excel(file_path)

print(df.head())
print(df.shape)
print(df.columns)

print("\n--- DATA TYPES ---")
print(df.dtypes)

print("\n--- MISSING VALUES ---")
print(df.isnull().sum())

print("\n--- DUPLICATE ROWS ---")
print(df.duplicated().sum())

print("\n--- BASIC STATISTICS ---")
print(df.describe())

print("\n--- CANCELLATION INVOICES ---")
print(df["InvoiceNo"].astype(str).str.startswith("C").value_counts())

print("\n--- CANCELLATION SAMPLE ---")

cancellations = df[
    df["InvoiceNo"].astype(str).str.startswith("C")
]

print(cancellations.head())

print("\n--- CANCELLATION QUANTITY ---")
print(cancellations["Quantity"].describe())

print("\n--- CANCELLATION PRICE ---")
print(cancellations["UnitPrice"].describe())

import pandas as pd

file_path = "data/raw/Online Retail.xlsx"

df = pd.read_excel(file_path)

# Remove completely duplicated rows
df = df.drop_duplicates()

# Remove rows without a product description
df = df.dropna(subset=["Description"])

# Convert CustomerID to nullable integer
df["CustomerID"] = df["CustomerID"].astype("Int64")

# Create revenue column
df["Revenue"] = df["Quantity"] * df["UnitPrice"]

# Identify cancellation invoices
df["IsCancellation"] = (
    df["InvoiceNo"]
    .astype(str)
    .str.startswith("C")
)

print(df.head())
print(df.shape)
print(df.dtypes)

print("\n--- MISSING VALUES ---")
print(df.isnull().sum())

print("\n--- NEGATIVE UNIT PRICES ---")
print((df["UnitPrice"] < 0).sum())

print("\n--- ZERO UNIT PRICES ---")
print((df["UnitPrice"] == 0).sum())

print("\n--- CANCELLATION CHECK ---")
print(df["IsCancellation"].value_counts())

print("\n--- REVENUE SUMMARY ---")
print(df["Revenue"].describe())

print("\n--- NEGATIVE PRICE ROWS ---")
print(df[df["UnitPrice"] < 0])

print("\n--- ZERO PRICE ROWS ---")
print(df[df["UnitPrice"] == 0].head(10))

print("\n--- EXTREME REVENUE ROWS ---")
print(
    df[
        df["Revenue"].abs() > 10000
    ][
        ["InvoiceNo", "StockCode", "Quantity", "UnitPrice", "Revenue"]
    ].head(10)
)
# Remove invalid and zero-priced transactions
df = df[df["UnitPrice"] > 0].copy()

print("\n--- AFTER PRICE CLEANING ---")
print("Rows remaining:", df.shape[0])

print("\n--- UNIT PRICE CHECK ---")
print("Negative prices:", (df["UnitPrice"] < 0).sum())
print("Zero prices:", (df["UnitPrice"] == 0).sum())

# Remove invalid and zero-priced transactions
output_path = "data/processed/cleaned_retail.csv"

df.to_csv(output_path, index=False)

print("\n--- FILE SAVED ---")
print(output_path)

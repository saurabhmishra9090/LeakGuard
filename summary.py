
import pandas as pd
from pathlib import Path

report_path = Path("reports") / "cross_department_review.csv"

if not report_path.exists():
    print("Error: Investigation report not found.")
else:
    df = pd.read_csv(
        report_path,
        dtype={
            "voucher": "string",
            "purchase_order": "string"
        }
    )

    print("\nLEAKGUARD - SUMMARY DASHBOARD")
    print("=" * 45)

    print(f"Review candidate groups: {len(df):,}")
    print(f"Unique suppliers: {df['supplier'].nunique():,}")
    print(f"Total repeated rows: {df['repeated_rows'].sum():,}")

    all_departments = set()

for value in df["departments"].dropna():
    for department in value.split(" | "):
        department = department.strip()
        if department:
            all_departments.add(department)

print("Unique departments:", len(all_departments))

    # Create a department-level report for Power BI
department_rows = []

for _, row in df.iterrows():
        departments = str(row["departments"]).split(" | ")

        for department in departments:
            department = department.strip()

            if department:
                department_rows.append({
                    "department": department,
                    "repeated_rows": row["repeated_rows"]
                })

department_df = pd.DataFrame(department_rows)

department_summary = (
        department_df.groupby("department", as_index=False)["repeated_rows"]
        .sum()
        .sort_values("repeated_rows", ascending=False)
    )
output_path = Path("reports") / "department_summary.csv"
department_summary.to_csv(output_path, index=False)

print("Department summary saved to:", output_path)
print(department_summary.to_string(index=False))


   
print("\nTOP 10 SUPPLIERS IN REVIEW CANDIDATES")
print("-" * 45)

print(
    df.groupby("supplier")["repeated_rows"]
    .sum()
    .sort_values(ascending=False)
    .head(10)
    .to_string()
)

print("\nINVESTIGATION REPORT LOADED SUCCESSFULLY")


print("\nINVESTIGATION REPORT LOADED SUCCESSFULLY")

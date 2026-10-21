
import duckdb
from pathlib import Path

file_path = r"C:\Users\SAURABH\Downloads\export.csv"

report_path = Path("reports") / "cross_department_review.csv"
report_path.parent.mkdir(parents=True, exist_ok=True)

con = duckdb.connect()

query = """
WITH cleaned_data AS (
    SELECT
        TRIM(CAST("Voucher" AS VARCHAR)) AS voucher,
        TRIM("Supplier & Other Non-Supplier Payees") AS supplier,pwd
        TRY_CAST(
            REPLACE(TRIM("Vouchers Paid"), ',', '')
            AS DECIMAL(18, 2)
        ) AS paid_amount,
        NULLIF(TRIM(CAST("Purchase Order" AS VARCHAR)), '') AS purchase_order,
        NULLIF(TRIM("Department"), '') AS department
    FROM read_csv_auto(?, sample_size=10000)
)
SELECT
    voucher,
    supplier,
    paid_amount,
    purchase_order,
    COUNT(*) AS repeated_rows,
    COUNT(DISTINCT department) AS department_count,
    STRING_AGG(DISTINCT department, ' | ') AS departments,
    'REVIEW - CROSS-DEPARTMENT MATCH' AS investigation_reason
FROM cleaned_data
WHERE voucher IS NOT NULL
  AND voucher <> ''
  AND supplier IS NOT NULL
  AND supplier <> ''
  AND paid_amount > 0
GROUP BY voucher, supplier, paid_amount, purchase_order
HAVING COUNT(*) > 1
   AND COUNT(DISTINCT department) > 1
ORDER BY department_count DESC, repeated_rows DESC
"""

try:
    results = con.execute(query, [file_path]).fetchdf()

    results.to_csv(
        report_path,
        index=False,
        encoding="utf-8-sig"
    )

    print("\nLEAKGUARD - REPORT EXPORT")
    print("=" * 50)
    print(f"Matching groups found: {len(results)}")
    print(f"Report saved to: {report_path.resolve()}")
    print("Report exported successfully!")

except Exception as error:
    print("An error occurred:")
    print(error)

finally:
    con.close()

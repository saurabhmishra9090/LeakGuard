
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, render_template

app = Flask(__name__)

@app.route("/favicon.ico")
def favicon():
    return "", 204


# Existing LeakGuard project directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT_ROOT / "reports"


def read_csv_safely(filename):
    """Read an existing report without modifying the original file."""
    path = REPORTS_DIR / filename

    if not path.exists():
        return pd.DataFrame()

    try:
        return pd.read_csv(path)
    except Exception as exc:
        app.logger.error("Could not read %s: %s", filename, exc)
        return pd.DataFrame()


@app.route("/")
def dashboard():
    return render_template("index.html")


@app.route("/api/dashboard")
def dashboard_data():
    review_df = read_csv_safely("cross_department_review.csv")
    department_df = read_csv_safely("department_summary.csv")

    suppliers = []
    departments = []

    if not review_df.empty:
        if "supplier" in review_df.columns:
            supplier_col = "supplier"
        elif "supplier_name" in review_df.columns:
            supplier_col = "supplier_name"
        else:
            supplier_col = None

        if supplier_col:
            counts = (
                review_df[supplier_col]
                .fillna("Unknown")
                .astype(str)
                .value_counts()
                .head(10)
            )
            suppliers = [
                {"name": str(name), "count": int(count)}
                for name, count in counts.items()
            ]

    if not department_df.empty:
        name_col = next(
            (col for col in ["department", "department_name"]
             if col in department_df.columns),
            None,
        )
        value_col = next(
            (col for col in ["repeated_rows", "count", "total"]
             if col in department_df.columns),
            None,
        )

        if name_col and value_col:
            departments = [
                {"name": str(row[name_col]), "count": int(row[value_col])}
                for _, row in department_df.head(10).iterrows()
                if pd.notna(row[name_col]) and pd.notna(row[value_col])
            ]

    # Send the actual investigation rows to the frontend table.
    review_records = []
    if not review_df.empty:
        for _, row in review_df.iterrows():
            record = {}
            for column in review_df.columns:
                value = row[column]
                if pd.isna(value):
                    record[column] = ""
                elif hasattr(value, "item"):
                    record[column] = value.item()
                else:
                    record[column] = value
            review_records.append(record)

    repeated_rows_total = (
        int(
            pd.to_numeric(
                review_df["repeated_rows"], errors="coerce"
            ).fillna(0).sum()
        )
        if "repeated_rows" in review_df.columns
        else 0
    )

    return jsonify({
        "review_candidates": int(len(review_df)),
        "repeated_rows": repeated_rows_total,
        "unique_suppliers": (
            int(review_df["supplier"].nunique())
            if "supplier" in review_df.columns
            else len(suppliers)
        ),
        "supplier_ranking": suppliers,
        "review_records": review_records,
        "department_summary": departments,
        "reports_found": {
            "cross_department_review": not review_df.empty,
            "department_summary": not department_df.empty,
        },
    })


if __name__ == "__main__":
    app.run(debug=True)


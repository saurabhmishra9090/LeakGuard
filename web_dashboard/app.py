
from pathlib import Path
import sqlite3

import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

@app.route("/favicon.ico")
def favicon():
    return "", 204


# Existing LeakGuard project directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT_ROOT / "reports"
DATABASE_PATH = PROJECT_ROOT / "leakguard.db"


def init_database():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS investigations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voucher TEXT NOT NULL,
                supplier TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending review',
                notes TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(voucher, supplier)
            )
        """)
 
def sync_investigations():
    review_df = read_csv_safely("cross_department_review.csv")

    if review_df.empty:
        return

    with sqlite3.connect(DATABASE_PATH) as connection:
        for _, row in review_df.iterrows():
            voucher = str(row.get("voucher", "")).strip()
            supplier = str(row.get("supplier", "")).strip()

            if not voucher or not supplier:
                continue

            connection.execute(
                """
                INSERT OR IGNORE INTO investigations (voucher, supplier)
                VALUES (?, ?)
                """,
                (voucher, supplier),
            )
       

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
        # Load saved investigation statuses from SQLite.
    with sqlite3.connect(DATABASE_PATH) as connection:
            investigation_rows = connection.execute(
                "SELECT id, voucher, supplier, status, notes FROM investigations"
            ).fetchall()

    investigation_statuses = {
    (voucher, supplier): {
        "id": investigation_id,
       "status": status,
       "notes": notes,
       "departments": ""
    }
    for investigation_id, voucher, supplier, status, notes in investigation_rows
}
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
                voucher = str(record.get("voucher", "")).strip()
                supplier = str(record.get("supplier", record.get("supplier_name", ""))).strip()

                saved = investigation_statuses.get((voucher, supplier))
                if saved:
                    record["status"] = saved["status"]
                    record["notes"] = saved["notes"]
                    record["investigation_id"] = saved["id"]
                    record["departments"] = str(
                    record.get("departments", record.get("department", ""))
)
            # Risk scoring starts here
            try:
                repeated_rows = int(record.get("repeated_rows", 0) or 0)
            except (ValueError, TypeError):
                repeated_rows = 0
            try:
                department_count = int(record.get("department_count", 0) or 0)
            except (ValueError, TypeError):
                department_count = 0
            risk_score = 0

            if repeated_rows >= 10:
                risk_score += 50
            elif repeated_rows >= 5:
                risk_score += 30
            elif repeated_rows >= 3:
                risk_score += 15

            if department_count >= 3:
                risk_score += 30
            elif department_count == 2:
                risk_score += 15

            if risk_score >= 45:
             risk_priority = "High"
            elif risk_score >= 30:
             risk_priority = "Medium"
            else:
             risk_priority = "Low"

            record["risk_score"] = risk_score
            record["risk_priority"] = risk_priority
                    
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
    supplier_payment_summary = []

    if not review_df.empty and "supplier" in review_df.columns and "paid_amount" in review_df.columns:
        payment_data = review_df.copy()
        payment_data["paid_amount"] = pd.to_numeric(
            payment_data["paid_amount"], errors="coerce"
        ).fillna(0)

        supplier_totals = (
            payment_data.groupby("supplier")["paid_amount"]
            .agg(["count", "sum", "mean", "max"])
            .sort_values("sum", ascending=False)
        )

        total_reviewed_payments = float(supplier_totals["sum"].sum())

        for supplier_name, row in supplier_totals.iterrows():
            supplier_payment_summary.append({
                "supplier": str(supplier_name),
                "record_count": int(row["count"]),
                "total_payment": round(float(row["sum"]), 2),
                "average_payment": round(float(row["mean"]), 2),
                "maximum_payment": round(float(row["max"]), 2),
                "payment_share_pct": round(
                    float(row["sum"]) / total_reviewed_payments * 100, 2
                ) if total_reviewed_payments else 0
            })
    else:
        total_reviewed_payments = 0

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
        "total_reviewed_payments": total_reviewed_payments,
        "supplier_payment_summary": supplier_payment_summary,
        "reports_found": {
            "cross_department_review": not review_df.empty,
            "department_summary": not department_df.empty,
        },
    })

@app.route("/api/investigations/<int:investigation_id>", methods=["PATCH"])
def update_investigation(investigation_id):
    payload = request.get_json(silent=True) or {}
    allowed_statuses = {
        "Pending review",
        "Under investigation",
        "Cleared",
        "Escalated",
    }

    status = payload.get("status")
    notes = payload.get("notes", "")

    if status not in allowed_statuses:
        return jsonify({"error": "Invalid investigation status"}), 400

    if not isinstance(notes, str):
        return jsonify({"error": "Notes must be text"}), 400

    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.execute(
            """
            UPDATE investigations
            SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (status, notes, investigation_id),
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Investigation not found"}), 404

    return jsonify({
        "id": investigation_id,
        "status": status,
        "notes": notes,
        "message": "Investigation updated successfully",
    })


if __name__ == "__main__":
    init_database()
    sync_investigations()
    app.run(debug=True)
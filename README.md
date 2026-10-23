# LeakGuard — Payment Integrity Radar

A data analytics project designed to identify potential payment irregularities, analyze supplier payment concentration, and support investigation workflows using public procurement payment data.

## Overview

LeakGuard transforms payment records into actionable review insights. It highlights repeated payment patterns and cross-department involvement so analysts can prioritize records for further validation.

**Important:** Flagged records are potential anomalies, not proof of fraud. Human review is required.

## Key Features

- **Payment Anomaly Review:** Identify repeated payment patterns that may require investigation.
- **Supplier Payment Exposure:** Analyze supplier-level payment totals, averages, maximum payments, and payment concentration.
- **Cross-Department Analysis:** Examine records associated with multiple departments.
- **Risk Prioritization:** Assign review priorities based on repeated rows and department involvement.
- **Investigation Workflow:** Track investigation status and save notes persistently.
- **Interactive Dashboard:** Search and filter review candidates by supplier, department, and risk priority.
- **CSV Exports:** Export supplier summaries and detailed investigation records.

## Tech Stack

- Python
- Pandas
- Flask
- SQLite
- HTML, CSS, JavaScript
- Chart.js

## Project Structure

```text
LeakGuard/
├── data/
├── reports/
├── sql/
├── src/
├── tests/
├── web_dashboard/
│   ├── app.py
│   ├── templates/
│   └── static/
├── main.py
├── summary.py
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Python 3
- pip

### Installation

1. Clone or download this repository.
2. Open a terminal in the project root.
3. Create and activate a virtual environment if required.
4. Install the project's dependencies.
5. Run the Flask dashboard.

Example commands for Windows:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install flask pandas
python web_dashboard\app.py
```

Open `http://127.0.0.1:5000` in your browser.

If the project has a `requirements.txt` file, prefer installing dependencies with `pip install -r requirements.txt`.

## Data and Responsible Use

This project is intended for analytical review and prioritization. Repeated records or supplier concentration do not independently establish fraud or misconduct. Findings should be validated against original payment records and supporting documentation.

## Future Improvements

- Automated data-quality checks
- More advanced anomaly detection
- Additional SQL-based analytical reporting
- Expanded automated tests
- Improved dashboard documentation and deployment

## Author

**Saurabh Mishra**

Data Analytics | Python | SQL | Flask | Dashboard Development

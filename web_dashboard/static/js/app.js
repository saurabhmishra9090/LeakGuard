
"use strict";
console.log("LeakGuard app.js file executing");

/* ==========================================
   LEAKGUARD — PAYMENT INTEGRITY RADAR
   Frontend dashboard controller
   ========================================== */

const state = {
    data: null,
    search: "",
    filter: "all",
    showAll: false,
    supplierChart: null,
    departmentChart: null,
    toastTimer: null
};

const $ = (selector) => document.querySelector(selector);


/* ---------- FORMATTING AND UTILITIES ---------- */

function formatNumber(value) {
    return new Intl.NumberFormat("en-IN").format(
        Number(value) || 0
    );
}

function escapeHTML(value) {
    const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => replacements[character]
    );
}

function showToast(message) {
    const toast = $("#toast");

    if (!toast) {
        console.info(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    if (state.toastTimer) {
        window.clearTimeout(state.toastTimer);
    }

    state.toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


/* ---------- LOAD REAL REPORT DATA ---------- */

async function loadDashboard() {
    const refreshButton = $("#refreshBtn");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
    }

    try {
        const response = await fetch("/api/dashboard", {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Dashboard API failed: HTTP ${response.status}`
            );
        }

        const data = await response.json();

        state.data = data;
        renderKPIs(data);
renderCharts(data);
renderTable(data);
renderSupplierPayments(data);
renderConnectionStatus(data);

        const updated = $("#lastUpdated");

        if (updated) {
            updated.textContent =
                "Updated " +
                new Date().toLocaleTimeString("en-IN");
        }

        showToast("Dashboard data refreshed.");

    } catch (error) {
        console.error("Dashboard loading error:", error);
        console.error("Error details:", error?.stack);

        const table = $("#reviewTable");

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        Unable to load report data.
                        Check the Flask server and report files.
                    </td>
                </tr>
            `;
        }

        const message = $("#connectionMessage");

        if (message) {
            message.textContent =
                "Connection failed. Check the server.";
        }

       showToast(`Dashboard load failed: ${error?.message || String(error)}`);

    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Refresh data";
        }
    }
}


/* ---------- KPI CARDS ---------- */

function renderKPIs(data) {
    const setText = (selector, value) => {
        const element = $(selector);

        if (element) {
            element.textContent = value;
        }
    };

    setText(
        "#repeatedRows",
        formatNumber(data.repeated_rows)
    );

    setText(
        "#reviewCandidates",
        formatNumber(data.review_candidates)
    );

    setText(
        "#uniqueSuppliers",
        formatNumber(data.unique_suppliers)
    );

    const reports = data.reports_found || {};

    const availableCount = Object.values(reports)
        .filter(Boolean).length;

    setText("#reportsAvailable", `${availableCount}/2`);
}
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}
/* -------- SUPPLIER PAYMENT SUMMARY -------- */

function renderSupplierPayments(data) {
    const table = $("#supplierPaymentTable");
    if (!table) return;

    const suppliers = Array.isArray(data.supplier_payment_summary)
        ? data.supplier_payment_summary
        : [];
    console.log("Supplier payment data:", suppliers.length, suppliers);

    if (suppliers.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No supplier payment data available.
                </td>
            </tr>
        `;
        return;
    }

    const totalPayments = Number(data.total_reviewed_payments) || 0;

    const topSupplier = suppliers[0];
    const topFiveShare = suppliers
        .slice(0, 5)
        .reduce((sum, supplier) => sum + (Number(supplier.payment_share_pct) || 0), 0);

    const totalElement = $("#totalReviewedPayments");
    const topSupplierElement = $("#topPaymentSupplier");
    const topPaymentElement = $("#topSupplierPayment");
    const topFiveElement = $("#topFiveShare");

    if (totalElement) {
        totalElement.textContent = formatCurrency(totalPayments);
    }

    if (topSupplierElement) {
        topSupplierElement.textContent = topSupplier.supplier;
    }

    if (topPaymentElement) {
        topPaymentElement.textContent = formatCurrency(topSupplier.total_payment);
    }

    if (topFiveElement) {
        topFiveElement.textContent = `${topFiveShare.toFixed(2)}%`;
    }

    table.innerHTML = suppliers.map(supplier => `
        <tr>
            <td>${escapeHTML(supplier.supplier)}</td>
            <td>${formatNumber(supplier.record_count)}</td>
            <td>${formatCurrency(supplier.total_payment)}</td>
            <td>${formatCurrency(supplier.average_payment)}</td>
            <td>${formatCurrency(supplier.maximum_payment)}</td>
            <td>${Number(supplier.payment_share_pct || 0).toFixed(2)}%</td>
        </tr>
    `).join("");
}
/* ---------- REPORT CONNECTION STATUS ---------- */

function renderConnectionStatus(data) {
    const message = $("#connectionMessage");

    if (!message) {
        return;
    }

    const reports = data.reports_found || {};

    const availableCount = Object.values(reports)
        .filter(Boolean).length;

    message.textContent =
        `${availableCount} of 2 report files loaded. ` +
        "Review candidates require human validation.";
}


/* ---------- CHARTS ---------- */

function renderCharts(data) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is unavailable.");
        showToast("Charts unavailable. Check internet access.");
        return;
    }

    const suppliers = Array.isArray(data.supplier_ranking)
        ? data.supplier_ranking
        : [];

    const departments = Array.isArray(data.department_summary)
        ? data.department_summary
        : [];

    if (state.supplierChart) {
        state.supplierChart.destroy();
        state.supplierChart = null;
    }

    if (state.departmentChart) {
        state.departmentChart.destroy();
        state.departmentChart = null;
    }

    const supplierCanvas = $("#supplierChart");

    if (supplierCanvas) {
        state.supplierChart = new Chart(supplierCanvas, {
            type: "bar",

            data: {
                labels: suppliers.map(item => item.name),

                datasets: [{
                    label: "Review groups",

                    data: suppliers.map(
                        item => Number(item.count) || 0
                    ),

                    backgroundColor: "#168df0",
                    hoverBackgroundColor: "#55b5ff",
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 13
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        backgroundColor: "#10283b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#c4d4e3",
                        borderColor: "#31516a",
                        borderWidth: 1
                    }
                },

                scales: {
                    x: {
                        beginAtZero: true,

                        ticks: {
                            color: "#8fa7ba",
                            precision: 0
                        },

                        grid: {
                            color: "#1b3042"
                        },

                        border: {
                            display: false
                        }
                    },

                    y: {
                        ticks: {
                            color: "#bdcddd",
                            font: {
                                size: 10
                            }
                        },

                        grid: {
                            display: false
                        },

                        border: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    const departmentCanvas = $("#departmentChart");

    if (departmentCanvas) {
        state.departmentChart = new Chart(departmentCanvas, {
            type: "bar",

            data: {
                labels: departments.map(item => item.name),

                datasets: [{
                    label: "Reported repeated rows",

                    data: departments.map(
                        item => Number(item.count) || 0
                    ),

                    backgroundColor: "#19bfdc",
                    hoverBackgroundColor: "#6ae9f7",
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 13
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        backgroundColor: "#10283b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#c4d4e3",
                        borderColor: "#31516a",
                        borderWidth: 1
                    }
                },

                scales: {
                    x: {
                        beginAtZero: true,

                        ticks: {
                            color: "#8fa7ba",
                            precision: 0
                        },

                        grid: {
                            color: "#1b3042"
                        },

                        border: {
                            display: false
                        }
                    },

                    y: {
                        ticks: {
                            color: "#bdcddd",
                            font: {
                                size: 10
                            }
                        },

                        grid: {
                            display: false
                        },

                        border: {
                            display: false
                        }
                    }
                }
            }
        });
    }
        const paymentCanvas = $("#supplierPaymentExposureChart");

   if (paymentCanvas) {
    const existingPaymentChart = Chart.getChart(paymentCanvas);

    if (existingPaymentChart) {
        existingPaymentChart.destroy();
    }

    new Chart(paymentCanvas, {
            type: "bar",
            data: {
                labels: (data.supplier_payment_summary || [])
                    .slice(0, 8)
                    .map(item => item.supplier),

                datasets: [{
                    label: "Total payment ($)",
                    data: (data.supplier_payment_summary || [])
                        .slice(0, 8)
                        .map(item => Number(item.total_payment) || 0),
                   backgroundColor: (context) =>
                   context.dataIndex === 0 ? "#F59E0B" : "#D97706",
                   hoverBackgroundColor: "#FDBA4A",
                   borderColor: (context) =>
                   context.dataIndex === 0 ? "#FCD34D" : "#D97706",
                   borderWidth: (context) =>
                   context.dataIndex === 0 ? 2 : 0,
                   borderRadius: 5,
                   barPercentage: 0.75,
                  categoryPercentage: 0.8

                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context =>
                                "$" + context.parsed.x.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            color: "#8fa7ba",
                            callback: value => "$" + Number(value).toLocaleString("en-US")
                        },
                        grid: { color: "#1b3042" }
                    },
                    y: {
                        ticks: { color: "#bdcddd" },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}


/* ---------- SUPPLIER REVIEW TABLE ---------- */


function populateFilterOptions(records) {
    const supplierFilter = $("#supplierFilter");
    const departmentFilter = $("#departmentFilter");

    if (!supplierFilter || !departmentFilter) return;

    const selectedSupplier = supplierFilter.value;
    const selectedDepartment = departmentFilter.value;

    const suppliers = [...new Set(
        records
            .map(record => String(record.supplier ?? record.supplier_name ?? "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    const departments = [...new Set(
        records.flatMap(record =>
            String(record.departments ?? record.department ?? "")
                .split("|")
                .map(value => value.trim())
                .filter(Boolean)
        )
    )].sort((a, b) => a.localeCompare(b));

    supplierFilter.innerHTML =
        '<option value="all">All suppliers</option>' +
        suppliers.map(supplier =>
            `<option value="${escapeHTML(supplier)}">${escapeHTML(supplier)}</option>`
        ).join("");

    departmentFilter.innerHTML =
        '<option value="all">All departments</option>' +
        departments.map(department =>
            `<option value="${escapeHTML(department)}">${escapeHTML(department)}</option>`
        ).join("");

    if (suppliers.includes(selectedSupplier)) {
        supplierFilter.value = selectedSupplier;
    }

    if (departments.includes(selectedDepartment)) {
        departmentFilter.value = selectedDepartment;
    }
}

function renderTable(data) {
    const table = $("#reviewTable");
    if (!table) return;

    const records = Array.isArray(data.review_records) ? data.review_records : [];
    populateFilterOptions(records);
    const searchTerm = state.search.trim().toLowerCase();

    const filtered = records.filter(record => {
        const searchable = [
            record.supplier,
            record.supplier_name,
            record.voucher,
            record.purchase_order,
            record.departments,
            record.department,
            record.investigation_reason,
            record.repeated_rows,
            record.paid_amount
        ].map(value => String(value ?? "").toLowerCase()).join(" ");

        const count = Number(record.repeated_rows) || 0;
        const matchesSearch = !searchTerm || searchable.includes(searchTerm);
       
const matchesFilter =
    state.filter === "all" ||
    (state.filter === "high" && count >= 10) ||
    (state.filter === "other" && count < 10);

const supplierFilter = $("#supplierFilter");
const departmentFilter = $("#departmentFilter");
const priorityFilter = $("#priorityFilter");
const selectedPriority = priorityFilter ? priorityFilter.value : "all";
const selectedSupplier = supplierFilter ? supplierFilter.value : "all";
const selectedDepartment = departmentFilter ? departmentFilter.value : "all";

const recordSupplier = String(record.supplier ?? record.supplier_name ?? "").trim();

const recordDepartments = String(record.departments ?? record.department ?? "")
    .split("|")
    .map(value => value.trim());

const matchesSupplier =
    selectedSupplier === "all" || recordSupplier === selectedSupplier;

const matchesDepartment =
    selectedDepartment === "all" || recordDepartments.includes(selectedDepartment);

const matchesPriority =
    selectedPriority === "all" ||
    String(record.risk_priority || "Low").toLowerCase() === selectedPriority.toLowerCase();

return matchesSearch && matchesFilter && matchesSupplier && matchesDepartment && matchesPriority;

    });

    const visibleRows = state.showAll ? filtered : filtered.slice(0, 6);
    const resultCount = $("#resultCount");
    if (resultCount) resultCount.textContent = `${filtered.length} review candidates`;

    const showMoreButton = $("#showMore");
    if (showMoreButton) {
        showMoreButton.textContent = state.showAll ? "Show fewer ↑" : "Show all rows ↓";
        showMoreButton.disabled = filtered.length <= 6;
    }

    if (!visibleRows.length) {
        table.innerHTML = `<tr><td colspan="4" class="empty-state">No matching review candidates found.</td></tr>`;
        return;
    }

    table.innerHTML = visibleRows.map((record, index) => {
        const supplier = escapeHTML(record.supplier || record.supplier_name || "Unknown supplier");
        const voucher = escapeHTML(record.voucher || record.purchase_order || `LG-${String(index + 1).padStart(3, "0")}`);
        const count = Number(record.repeated_rows) || 0;
       const statusText = record.status || (count >= 10 ? "Priority review" : "Review");
const statusClass = record.status ? " investigation-status" : (count >= 10 ? "" : " review");
        const riskPriority = record.risk_priority || "Low";
        const riskClass = riskPriority.toLowerCase();

        return `
    <tr>
        <td>
            <div class="supplier-name" title="${supplier}">${supplier}</div>
        </td>
        <td>
            <span class="row-id">${voucher}</span>
        </td>
        <td>
            <span class="count-value">${formatNumber(count)}</span>
        </td>
        <td>
            <div class="investigation-controls">
                <select
                    class="investigation-status-select"
                    data-id="${record.investigation_id}"
                    aria-label="Investigation status"
                >
                    <option value="Pending review" ${record.status === "Pending review" ? "selected" : ""}>Pending review</option>
                    <option value="Under investigation" ${record.status === "Under investigation" ? "selected" : ""}>Under investigation</option>
                    <option value="Cleared" ${record.status === "Cleared" ? "selected" : ""}>Cleared</option>
                    <option value="Escalated" ${record.status === "Escalated" ? "selected" : ""}>Escalated</option>
                </select>

                <textarea
                    class="investigation-notes"
                    data-id="${record.investigation_id}"
                    placeholder="Add investigation notes..."
                    aria-label="Investigation notes"
                    rows="2"
                >${record.notes || ""}</textarea>

                <button
                    type="button"
                    class="save-investigation-btn"
                    data-id="${record.investigation_id}"
                >Save</button>
            </div>
        </td>
                    <td>
                <span class="risk-badge ${riskClass}">
                    ${riskPriority}
                </span>
            </td>
    </tr>
`;
    }).join("");
}

/* ---------- AI ANALYST CHAT ---------- */

function addChatMessage(message, role = "assistant") {
    const container = $("#chatMessages");

    if (!container) {
        return;
    }

    const bubble = document.createElement("div");

    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = message;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function answerDataQuestion(question) {
    if (!state.data) {
        return "Report data is not loaded yet. Refresh the dashboard first.";
    }

    const data = state.data;
    const query = question.toLowerCase();

    const suppliers = Array.isArray(data.supplier_ranking)
        ? data.supplier_ranking
        : [];

    const departments = Array.isArray(data.department_summary)
        ? data.department_summary
        : [];

    if (query.includes("department")) {
        if (departments.length === 0) {
            return "No usable department summary data is available. Check the report columns.";
        }

        const lines = departments.slice(0, 5).map(item =>
            `• ${item.name}: ${formatNumber(item.count)} reported rows`
        );

        return (
            "Department involvement in the loaded report:\n" +
            lines.join("\n") +
            "\n\nDepartment involvement can overlap across review groups. " +
            "These values are not unique payment totals."
        );
    }

    if (
        query.includes("supplier") ||
        query.includes("top")
    ) {
        if (suppliers.length === 0) {
            return "No supplier ranking data is available.";
        }

        const lines = suppliers.slice(0, 5).map((item, index) =>
            `${index + 1}. ${item.name}: ${formatNumber(item.count)} groups`
        );

        return (
            "Suppliers with the most groups in the current ranking:\n" +
            lines.join("\n") +
            "\n\nThese are review signals, not proof of fraud."
        );
    }

    if (
        query.includes("candidate") ||
        query.includes("review") ||
        query.includes("summar")
    ) {
        return (
            "Dashboard summary:\n" +
            `• Review candidates: ${formatNumber(data.review_candidates)}\n` +
            `• Repeated-row total: ${formatNumber(data.repeated_rows)}\n` +
            `• Suppliers identified: ${formatNumber(data.unique_suppliers)}\n\n` +
            "All flagged cases require human validation."
        );
    }

    return (
        "You can ask me to summarize the dashboard, list top suppliers, " +
        "explain review candidates, or summarize department involvement."
    );
}


/* ---------- USER INTERACTIONS ---------- */

function setupInteractions() {1
    const searchInput = $("#globalSearch");

    if (searchInput) {
        searchInput.addEventListener("input", event => {
            state.search = event.target.value;
            renderTable(state.data || {});
        });
    }

    const riskFilter = $("#riskFilter");

    if (riskFilter) {
        riskFilter.addEventListener("change", event => {
            state.filter = event.target.value;
            renderTable(state.data || {});
        });
    }
    
const supplierFilter = $("#supplierFilter");
if (supplierFilter) {
    supplierFilter.addEventListener("change", () => {
        state.showAll = false;
        renderTable(state.data || {});
    });
}

const departmentFilter = $("#departmentFilter");
if (departmentFilter) {
    departmentFilter.addEventListener("change", () => {
        state.showAll = false;
        renderTable(state.data || {});
    });
}
const priorityFilter = $("#priorityFilter");

if (priorityFilter) {
    priorityFilter.addEventListener("change", () => {
        state.showAll = false;
        renderTable(state.data || {});
    });
}


    const clearSearchButton = $("#clearSearch");

    if (clearSearchButton) {
        clearSearchButton.addEventListener("click", () => {
            state.search = "";
            state.filter = "all";
            if (supplierFilter) supplierFilter.value = "all";
            if (departmentFilter) departmentFilter.value = "all";
            state.showAll = false;

            if (searchInput) {
                searchInput.value = "";
            }

            if (riskFilter) {
                riskFilter.value = "all";
            }

            renderTable(state.data || {});
        });
    }

    const showMoreButton = $("#showMore");

    if (showMoreButton) {
        showMoreButton.addEventListener("click", () => {
            state.showAll = !state.showAll;
            renderTable(state.data || {});
        });
    }

    const refreshButton = $("#refreshBtn");

    if (refreshButton) {
        refreshButton.addEventListener("click", loadDashboard);
        console.log("Refresh button listener registered");
        
} else {
    console.error("Refresh button element not found");
    }

    const exportButton = $("#exportBtn");

    if (exportButton) {
        exportButton.addEventListener("click", exportSupplierReport);
    }
    const detailedExportButton = $("#detailedExportBtn");

if (detailedExportButton) {
    detailedExportButton.addEventListener(
        "click",
        exportInvestigationDetails
    );
}

    const chatForm = $("#chatForm");
    const chatInput = $("#chatInput");

    if (chatForm && chatInput) {
        chatForm.addEventListener("submit", event => {
            event.preventDefault();

            const question = chatInput.value.trim();

            if (!question) {
                return;
            }

            addChatMessage(question, "user");
            chatInput.value = "";

            addChatMessage(
                answerDataQuestion(question),
                "assistant"
            );
        });
    }

    document.querySelectorAll("[data-question]").forEach(button => {
        button.addEventListener("click", () => {
            const question =
                button.getAttribute("data-question") || "";

            addChatMessage(question, "user");

            addChatMessage(
                answerDataQuestion(question),
                "assistant"
            );
        });
    });
       document.addEventListener("click", async (event) => {
    const button = event.target.closest(".save-investigation-btn");

    if (!button) return;

    const id = button.dataset.id;
    const row = button.closest("tr");

    if (!id || !row) {
        showToast("Investigation row not found.");
        return;
    }

    const statusSelect = row.querySelector(".investigation-status-select");
    const notesInput = row.querySelector(".investigation-notes");

    if (!statusSelect || !notesInput) {
        showToast("Status or notes field not found.");
        return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(`/api/investigations/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: statusSelect.value,
                notes: notesInput.value
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Unable to save investigation.");
        }

        showToast("Investigation saved successfully.");
        await loadDashboard();

    } catch (error) {
        console.error("Save investigation error:", error);
        showToast(error.message || "Failed to save investigation.");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
});
}


/* ---------- CSV EXPORT ---------- */

function exportSupplierReport() {
    if (!state.data) {
        showToast("No dashboard data is available to export.");
        return;
    }

    const suppliers = Array.isArray(state.data.supplier_ranking)
        ? state.data.supplier_ranking
        : [];

    const rows = [
        ["Supplier", "Review groups"],
        ...suppliers.map(item => [
            item.name,
            item.count
        ])
    ];

    const csv = rows.map(row =>
        row.map(value =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
        ).join(",")
    ).join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "leakguard_supplier_review.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Supplier review CSV exported.");
}
/* -------- DETAILED INVESTIGATION CSV EXPORT -------- */

function exportInvestigationDetails() {
    const data = state.data;

    if (!data || !Array.isArray(data.review_records)) {
        showToast("No investigation data available to export.");
        return;
    }

    const headers = [
        "Voucher",
        "Supplier",
        "Repeated Rows",
        "Departments",
        "Investigation Status",
        "Investigation Notes"
    ];

    const rows = data.review_records.map(record => [
        record.voucher ?? "",
        record.supplier ?? record.supplier_name ?? "",
        record.repeated_rows ?? "",
        record.departments ?? record.department ?? "",
        record.status ?? "Pending review",
        record.notes ?? ""
    ]);

    const escapeCsvValue = value => {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [headers, ...rows]
        .map(row => row.map(escapeCsvValue).join(","))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "leakguard_investigation_details.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Investigation details CSV exported.");
}


/* ---------- APPLICATION START ---------- */

document.addEventListener("DOMContentLoaded", () => {
    console.log("LeakGuard JavaScript initialized");
    setupInteractions();
    loadDashboard();
});

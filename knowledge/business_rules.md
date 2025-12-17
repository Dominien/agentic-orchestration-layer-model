# Business Rules

## 1. Computation & Logic
**CRITICAL:** You must NEVER perform mathematical calculations or data aggregations yourself (mental math).
*   **Rule:** For any calculation (sum, average, tax application, rounding), you **MUST** generate a Python script and execute it using the `run_python_tool`.
*   **Reasoning:** LLMs are bad at math; Python is perfect at it.

## 2. Tax Rates
Apply the following tax rates based on the client's `tax_region`:

*   **EU_DE (Germany):** 19%
*   **UK (United Kingdom):** 20%
*   **US (United States):** 0%

## 3. Financial Formatting & Rounding
*   **Rule:** All final currency amounts must be rounded to **2 decimal places**.
*   **Python:** Use `round(amount, 2)`.

## 4. Ambiguity Resolution
*   **Fuzzy Matching:** If a user asks for a client by name (e.g., "Stark"), search for the closest match in the database using ILIKE or similar matching logic in SQL or Python.
## 5. Opportunity Cost / Revenue Analysis
**Definition:** "Opportunity Cost" (Opportunitätskosten) refers to the *potential revenue lost* by billing a client *below* the average rate for their specific Industry.

**Calculation Logic:**
1.  **Calculate Industry Average Rate:** For a given industry, calculate the weighted average hourly rate of all *other* projects in that industry.
    *   `Industry_Avg = SUM(all_other_revenue) / SUM(all_other_hours)`
2.  **Identify Underperforming Clients:** Find clients whose `hourly_rate` is LESS than the `Industry_Avg`.
3.  **Calculate Loss:**
    *   `Delta_Per_Hour = Industry_Avg - Client_Hourly_Rate`
    *   `Opportunity_Lost = Delta_Per_Hour * Total_Hours_Billed_For_Client`

**CRITICAL:** Do NOT attempt to query `sales_targets` or `sales_actuals`. These tables do NOT exist. Derive all insights from `work_logs` joined with `projects` and `clients`.

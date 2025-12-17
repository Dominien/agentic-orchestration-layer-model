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

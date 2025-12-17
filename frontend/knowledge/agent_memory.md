# Agent Memory & Learned Lessons

This file serves as the long-term memory for the Agentic Orchestration Layer.
It contains lessons learned from previous errors, successful query patterns, and schema clarifications.

**INSTRUCTIONS FOR THE AGENT:**
1.  **READ**: Always read this file at the start of complex tasks to avoid repeating past mistakes.
2.  **WRITE**: If you encounter a tool error (SQL syntax, Python logic) and successfully resolve it, you MUST append a new entry here using the `add_learned_lesson` tool.

---

## Learned Lessons

### [Example] SQL Recursive CTEs
- **Problem**: Tried to use `WITH RECURSIVE` to query hierarchy.
- **Error**: `Security Error: Only SELECT queries are allowed.`
- **Solution**: The `run_readonly_sql` tool does not support complex recursive CTEs or multi-statement blocks. Rewrote logic using standard `JOIN`s or multiple simpler queries processed in Python.


### [Learned 2025-12-17]
## SQL CTEs vs. Subqueries
- **Problem**: A SQL query using a Common Table Expression (CTE) with the `WITH` keyword failed.
- **Error**: `Security Error: Only SELECT queries are allowed.`
- **Solution**: The security filter for the `run_readonly_sql` tool is strict and rejects queries that do not start with `SELECT`. Rewrote the query to use a subquery instead of a CTE. This is functionally equivalent and passes the security check. For example, `WITH t AS (...) SELECT ... FROM t` should be rewritten as `SELECT ... FROM (...) AS t`.

### [Learned 2025-12-17]
## Pattern: Triangulation via Data Injection
- **Problem**: The Python sandbox cannot access the database directly.
- **Solution**: To verify numbers, we use the **Triangulation Pattern**.
    1. **Path A**: Standard `sql_query` to get the answer from DB.
    2. **Path B**: Use `raw_data_query` to fetch the source rows from DB.
    3. **Injection**: The `triangulation_tool` automatically injects this raw data as a pandas DataFrame (`df`) into the Python environment.
    4. **Python Logic**: Write code to calculate the answer from `df` (e.g., `df['col'].sum()`).
    - **Result**: We get 100% deterministic verification without giving Python DB access.

## Python Safety Policy
- **Problem**: The `run_python` tool returned a `Security Error` because the code was missing a verification step.
- **Solution**: ALL Python code executed with `run_python` MUST include at least one `assert` statement to validate the result before printing. For example, `assert revenue >= 0, "Revenue cannot be negative"`. This is a strict, non-negotiable platform requirement.

### [Learned 2025-12-17]
## [Python/SQL Analysis]
- **Problem**: Python `reset_index(name=...)` caused a TypeError on a groupby result. SQL `HAVING` clause incorrectly filtered the final groups (industries) instead of the prerequisite entities (clients with >$5k spend).
- **Solution**: In Python, assign calculated columns explicitly to the DataFrame (e.g., `df['new_col'] = ...`) rather than using complex chaining. In SQL, use a CTE (WITH clause) to filter specific entities (clients) based on criteria first, then join that back to the main table for the final aggregation.
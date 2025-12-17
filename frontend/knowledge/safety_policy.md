# Code Safety & Verification Policy

The **Agentic Orchestration Layer** enforces strict safety standards on all generated code.
Before interacting with any sandbox or database, the Agent must cross-reference its plan against this policy.

## 1. The "Code verification" Rule (MANDATORY)
The Agent MUST NOT operate on blind faith.
*   **Restriction**: Every Python script must include at least one `assert` statement to validate its own output.
*   **Why**: Reasoning engines make arithmetic errors. Code engines do not, but only if the logic is sound. Assertions bridge this gap.
*   **Failure Mode**: If code is submitted without an assertion, the "Supervisor Layer" (Tool Logic) will typically reject it.

## 2. No Infinite Loops
*   **Restriction**: Avoid `while True` or unbounded loops.
*   **Safe Pattern**: Use `for` loops with explicit `break` conditions or reasonable ranges (e.g., `range(0, 50)`).

## 3. Data Privacy & Leaks
*   **Restriction**: Do not `print()` entire tables or DataFrames unless explicitly asked.
*   **Safe Pattern**: Print `.head(5)` or `.describe()` to verify data structure without flooding the context window.
*   **PII**: Do not include hardcoded PII (names, emails) in the scripts unless it's a specific search term provided by the user.

## 4. Deterministic Logic
*   **Restriction**: Avoid random number generation (`random.choice`) unless the task specifically requires simulation.
*   **Goal**: The same question should yield the same answer, every time.

## 5. Security Sanity Checks
*   **SQL**: Never concatenate strings into SQL queries manually if a safer pattern exists (though `run_readonly_sql` handles the connection, the logic itself should be clean).
*   **Filesystem**: Do not attempt to read system files (`/etc/passwd`, `.env`) outside the sandbox.

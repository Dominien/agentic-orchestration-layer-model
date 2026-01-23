# Agentic Orchestration Layer Model
> **The Runtime Co-Processor**: Engineered Reliability in Probabilistic Systems.

## The Technical Thesis: Why "Chatbots" Fail in Production
Traditional RAG (Retrieval Augmented Generation) architectures fail in enterprise environments because they rely on **Semantic Search** (Text-to-Text). If you ask "What is the revenue?", RAG finds a text document that *looks* like regarding revenue and summarizes it. This is **Fuzzy Logic**.

This repository implements **CAG (Code Augmented Generation)**. It treats the LLM not as a database, but as a **Just-In-Time Compiler**.
When a user asks a question, the System:
1.  **Injects** the Schema & Physical Laws (Context).
2.  **Compiles** a bespoke execution plan (SQL/Python).
3.  **Executes** the code in a secure sandbox.
4.  **Triangulates** the result across multiple compute paths.

The result is **Deterministic Execution** from **Probabilistic Intent**.

### System Architecture: The "System 2" Middleware
| Component | Function | Technology |
| :--- | :--- | :--- |
| **Cognitive Layer** | **The Orchestrator.** Plans, hypothesizes, and orchestrates execution using encrypted "Native Thinking" to simulate outcomes. | **Gemini 3 Pro** (ThinkingLevel.HIGH) |
| **Capability Layer** | **Runtime Tools.** A Generic SQL tool for dynamic schema mapping and a secure Sandbox for math/logic execution. | **Supabase** + **E2B Code Interpreter** |
| **Knowledge Layer** | **The Constitution.** Business logic defined in Markdown files, loaded into context for instant adaptation without code deploys. | **In-Context Learning** |
| **Supervisor Layer** | **Safety & Verification.** Uses a "Triangulation Protocol" (calculating via SQL path vs Python path) to verify data integrity (Delta < 1%). | **Zod** + **Runtime Assertions** |

---

## 1. The Runtime Co-Processor (`core.ts`)

In `frontend/lib/agent/core.ts`, we implement what Andrej Karpathy describes as "Software 2.0"—but with a strict containment layer.

### Context Injection (The "World State")
Likely the most critical part of `core.ts` is the **System Injection** (Line 194). We do not rely on the model "remembering" training data. We inject the *current* reality of the system into the context window at runtime.

```typescript
// frontend/lib/agent/core.ts [194-206]
const contextInjection = `\n\n[SYSTEM INJECTION: ACTIVE CONTEXT]
The following files are pre-loaded...
=== DATABASE SCHEMA ===\n${schemaContent}\n
=== BUSINESS RULES ===\n${rulesContent}\n
=== AGENT MEMORY (LESSONS) ===\n${memoryContent}\n`;
```

This guarantees that if you update `business_rules.md`, the "Agent" adapts instantly without retraining. The **Environment is the Prompt**.



---



## 2. The Architecture of Containment (`run_python_tool.ts`)

The "Ghost in the Machine" (Hallucination) is tamed not by better prompting, but by **Hard Engineering Constraints**.
In `frontend/lib/tools/run_python_tool.ts`, we implement the **Logic Verifier**.

The LLM is **forbidden** from returning code that does not self-validate. We parse the AST (Abstract Syntax Tree) equivalent to ensure `assert` statements exist.

```typescript
// frontend/lib/tools/run_python_tool.ts [26-37]
if (!args.code.includes('assert')) {
  return `Security Error: Code Verification Failed.
  You violated the "Safety Policy". All Python code must include at least one 'assert' statement...`;
}
```

If the model attempts to guess a number, the runtime rejects the code. It *must* prove its work mathematically. This is **Defensive Architecture**.

---

## 3. The Triangulation Protocol (`triangulation_tool.ts`)

> **Note**: This architecture draws inspiration from **Ilya Sutskever's "Value Function"**, utilizing distinct cognitive paths to converge on a verified truth.

This is the system's "Double-Entry Bookkeeping". For any quantitative question, we do not trust a single execution path.
Defined in `frontend/lib/tools/triangulation_tool.ts`, the system enforces a consensus check between **Vector A (Database Engine)** and **Vector B (Runtime Computation)**.

### Path A: The Direct Query
The Agent generates a SQL query to solve the problem on the Database Layer.
```typescript
// frontend/lib/tools/triangulation_tool.ts [22]
runReadonlySqlTool({ query: args.sql_query })
```

### Path B: The Sandbox Injection
The Agent simultaneously fetches *Raw Data* and injects it into an isolated Python Sandbox (E2B).
```typescript
// frontend/lib/tools/triangulation_tool.ts [70-80]
const pythonDriver = `
import pandas as pd
# [SYSTEM INJECTION] Load Raw Data from Host
raw_json = '''${rawDataJson}'''
df = pd.DataFrame(json.loads(raw_json))
# [USER LOGIC]
${args.python_code}
`;
```

### The Truth Gate
We calculate the Delta between the two Scalars. If `|A - B| > 1%`, the system throws a `FAILED_TRUTH` exception.
```typescript
// frontend/lib/tools/triangulation_tool.ts [120]
const v_truth = diff < 0.01 ? 1 : 0; // 1% Tolerance
```
This mathematically prevents calculation hallucinations.

---

## 4. The Efficiency Gap

Why build this?
*   **Static Systems (Standard Dashboards)**: High Reliability, Low Flexibility. "I can only tell you what I was programmed to tell you."
*   **Chatbots (Standard AI)**: High Flexibility, Low Reliability. "I can guess the answer."
*   **Agentic Orchestration (This Logic)**: High Flexibility, High Reliability.

We are bridging the gap by using GenAI as a **Middleware** that writes the integration glue-code at runtime (`run_python`, `run_sql`), but protecting the Core System with rigid validation (`zod`, `assert`, `Triangulation`).

## Technical Stack

*   **Orchestrator**: Google Gemini 3 Pro (Thinking Level: HIGH)
*   **Runtime**: Node.js v20+ / Next.js 16
*   **Sandboxing**: E2B (Code Interpreter)
*   **Interface**: React / Tailwind v4

## How to Run

1.  **Configure Environment**:
    Inside `knowledge/`, define your `database_schema.md` and `safety_policy.md`.
2.  **Start the Orchestrator**:
    ```bash
    npm run dev
    ```
3.  **Inspect the Thinking**:
    The UI visualizes the `thoughtSignature` stream, showing the decision process (SQL generation -> Python Verification -> Rendering).

---

## 6. Future Roadmap: The Autonomous Value Function

The next evolution of this engine moves beyond *provided* knowledge to *autonomous discovery*.

**The Goal**: Give the Agent a raw connection string (e.g., `postgres://...`) to a database it has never seen.
**The Mechanism**: The Agent autonomously crawls the tables, profiles the data distribution, and writes its own `database_schema.md`.

### The Value Function (Discovery Metric)
How does the agent know when it understands the data?
We propose a **Recursive Value Function**:
1.  **Hypothesize**: "I believe Table A is related to Table B via `user_id`."
2.  **Test**: Run a JOIN query.
3.  **Evaluate**:
    *   If the query fails or returns empty sets -> **Negative Reward** (High Surprise).
    *   If the query returns consistent correlations -> **Positive Reward** (Low Surprise).

The Agent continues its exploration loop until the **Marginal Value of Information** drops below a threshold, effectively "Graduating" itself as an expert on that specific database without human intervention.

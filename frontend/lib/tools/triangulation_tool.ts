import { z } from 'zod';
import { runReadonlySqlTool } from './run_readonly_sql_tool';
import { runPythonTool } from './run_python_tool';

export const triangulationToolDefinition = {
  name: 'verify_integrity',
  description: 'MANDATORY for Quantitative Questions. Executes a "Double Check" by running two independent paths (SQL and Python) to verify the result is not a hallucination.',
  inputSchema: z.object({
    sql_query: z.string().describe('Path A: A SQL query to calculate the metric directly in the DB (result must be a single row/value).'),
    raw_data_query: z.string().describe('Path B (Fetch): A SQL query to fetch the RAW DATA needed for the Python calculation (e.g. "SELECT * FROM work_logs LIMIT 10").'),
    python_code: z.string().describe('Path B (Logic): Python code to calculate the metric. ASSUME a pandas DataFrame named `df` IS ALREADY LOADED with the result of `raw_data_query`. You do NOT need to load data. Just calculation.'),
    metric_name: z.string().describe('Name of the metric being verified (e.g. "Total Revenue").'),
  }),
};

export async function triangulationTool(args: z.infer<typeof triangulationToolDefinition.inputSchema>) {
  console.log(`[Triangulation] Starting verification for ${args.metric_name}...`);

  // 1. V_PHYSICS: Parallel Execution
  // Run SQL (Path A) and Raw Data Fetch (Path B Pre-requisite)
  const [sqlResult, rawDataResult] = await Promise.all([
    runReadonlySqlTool({ query: args.sql_query }),
    runReadonlySqlTool({ query: args.raw_data_query })
  ]);

  // 2. Extract Scalar Values (Path A)
  let valA: number | null = null;
  try {
      if (typeof sqlResult === 'string') {
        const parsed = JSON.parse(sqlResult);
        
        // Check for List/Table return (which is invalid for this tool)
        if (Array.isArray(parsed) && parsed.length > 1) {
             return JSON.stringify({
                status: "USAGE_ERROR",
                message: "This tool only supports Single Scalar verification (e.g. Total Revenue). You passed a List/Table (Top 5).",
                suggestion: "Do NOT use verify_integrity for lists. Use run_python or run_readonly_sql directly for rankings."
            });
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
            const firstRow = parsed[0];
            const firstVal = Object.values(firstRow)[0];
            
            // Validate it is a number
            if (typeof firstVal === 'number') {
                valA = firstVal;
            } else {
                 return JSON.stringify({
                    status: "USAGE_ERROR",
                    message: `SQL returned a non-numeric value: "${firstVal}".`,
                    suggestion: "Ensure your SQL query returns a SINGLE number (e.g. SUM, COUNT, AVG)."
                });
            }
        }
      }
  } catch (e) {
      // Failed to parse SQL result
  }

  // 3. Prepare Python Environment (Path B)
  // We explicitly INJECT the data into the Python script.
  // The sandbox cannot fetch data, so we feed it.
  
  // Escape the JSON to be safe inside a Python string
  // This is a naive injection; for large datasets, this might be slow, but safe for 'last 10 rows'.
  const rawDataJson = JSON.stringify(JSON.parse(rawDataResult as string)); 
  
  // Construct the Python Driver Script
  const pythonDriver = `
import pandas as pd
import json
from io import StringIO

# [SYSTEM INJECTION] Load Raw Data from Host
try:
    raw_json = '''${rawDataJson}'''
    data = json.loads(raw_json)
    df = pd.DataFrame(data)
except Exception as e:
    print(f"Error loading injected data: {e}")
    exit(1)

# [USER LOGIC]
${args.python_code}
`;

  // Run Python Logic
  const pythonResult = await runPythonTool({ code: pythonDriver });

  // 4. Parse Python Result
  let valB: number | null = null;
  try {
      const matches = pythonResult.match(/-?\d+(\.\d+)?/g);
      if (matches && matches.length > 0) {
          valB = parseFloat(matches[matches.length - 1]);
      }
  } catch (e) {
      // Failed to parse Python result
  }

  // 5. V_TRUTH: Triangulation Logic
  const v_physics = (valA !== null && valB !== null) ? 1 : 0;
  
  if (v_physics === 0) {
      return JSON.stringify({
          status: "FAILED_PHYSICS",
          message: "One or both paths failed to produce a valid number.",
          debug: { sql_raw: sqlResult, python_result: pythonResult }
      });
  }

  let diff = 0;
  if (valA === 0) {
       diff = (valB === 0) ? 0 : 1; 
  } else {
       diff = Math.abs((valA! - valB!) / valA!);
  }

  const v_truth = diff < 0.01 ? 1 : 0; // 1% Tolerance

  if (v_truth === 1) {
      return JSON.stringify({
          status: "VERIFIED",
          confidence: "HIGH",
          metric: args.metric_name,
          value: valA, 
          verification_delta: `${(diff * 100).toFixed(2)}%`,
          method: "Triangulation (SQL + Python)"
      });
  } else {
      return JSON.stringify({
          status: "FAILED_TRUTH",
          message: `Logic Error: SQL result (${valA}) diverged from Python result (${valB}).`,
          difference: `${(diff * 100).toFixed(2)}%`,
          suggestion: "Investigate logic. Did the SQL join multiply rows? Did Python filter correctly?",
          debug_python_code: args.python_code
      });
  }
}

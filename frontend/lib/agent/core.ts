import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { readFileTool, readFileToolDefinition } from '../tools/read_file_tool';
import { runReadonlySqlTool, runReadonlySqlToolDefinition } from '../tools/run_readonly_sql_tool';
import { runPythonTool, runPythonToolDefinition } from '../tools/run_python_tool';
import { render_dashboard, renderDashboardTool } from '../tools/dashboard_tool';
import { addLearnedLessonTool, addLearnedLessonToolDefinition } from '../tools/add_learned_lesson_tool';
import { triangulationTool, triangulationToolDefinition } from '../tools/triangulation_tool';
import fs from 'fs/promises';
import path from 'path';

const toolMap: Record<string, Function> = {
  [readFileToolDefinition.name]: readFileTool,
  [runReadonlySqlToolDefinition.name]: runReadonlySqlTool,
  [runPythonToolDefinition.name]: runPythonTool,
  [render_dashboard.name]: renderDashboardTool,
  [addLearnedLessonToolDefinition.name]: addLearnedLessonTool,
  [triangulationToolDefinition.name]: triangulationTool,
};

// Define tools for Gemini 3 (Array of tool objects)
const tools = [
  {
    functionDeclarations: [
      {
        name: readFileToolDefinition.name,
        description: readFileToolDefinition.description,
        parameters: {
          type: Type.OBJECT,
          properties: {
             filename: {
               type: Type.STRING,
               description: readFileToolDefinition.inputSchema.shape.filename.description
             }
          },
          required: ['filename']
        }
      },
      {
        name: runReadonlySqlToolDefinition.name,
        description: runReadonlySqlToolDefinition.description,
        parameters: {
          type: Type.OBJECT,
          properties: {
             query: {
               type: Type.STRING,
               description: runReadonlySqlToolDefinition.inputSchema.shape.query.description
             }
          },
          required: ['query']
        }
      },
      {
         name: runPythonToolDefinition.name,
         description: runPythonToolDefinition.description,
         parameters: {
           type: Type.OBJECT,
           properties: {
              code: {
                type: Type.STRING,
                description: runPythonToolDefinition.inputSchema.shape.code.description
              }
           },
           required: ['code']
         }
       },
       {
          name: render_dashboard.name,
          description: render_dashboard.description,
          parameters: render_dashboard.parameters
       },
       {
          name: addLearnedLessonToolDefinition.name,
          description: addLearnedLessonToolDefinition.description,
          parameters: {
            type: Type.OBJECT,
            properties: {
               lesson: {
                 type: Type.STRING,
                 description: addLearnedLessonToolDefinition.inputSchema.shape.lesson.description
               }
            },
             required: ['lesson']
           }
        },
        {
           name: triangulationToolDefinition.name,
           description: triangulationToolDefinition.description,
           parameters: {
             type: Type.OBJECT,
             properties: {
                sql_query: {
                  type: Type.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.sql_query.description
                },
                raw_data_query: {
                  type: Type.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.raw_data_query.description
                },
                python_code: {
                  type: Type.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.python_code.description
                },
                metric_name: {
                  type: Type.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.metric_name.description
                }
             },
             required: ['sql_query', 'raw_data_query', 'python_code', 'metric_name']
           }
        }
    ]
  }
];

const SYSTEM_PROMPT = "You are an elite autonomous AI Orchestrator providing high-end business intelligence.\\n" +
      "\\n" +
      "CORE BEHAVIORS:\\n" +
      "2. **Documentation First**: You start with zero knowledge. Always read /knowledge files first to understand schemas and rules. specifically database_schema.md, business_rules.md, AND visualization_capabilities.md.\\n" +
      "   **CRITICAL - RECURSIVE MEMORY**: You must ALSO read 'agent_memory.md' to learn from previous mistakes. If you encounter a problem, check if it's already solved there.\\n" +
      "3. **Reality Check**: NEVER invent table names (like 'sales_targets') or data. If a SQL query fails, STOP and check the schema.\\n" +
       "4. **Self-Correction & Memory (STRICT)**: \n" +
       "   - Use `add_learned_lesson` ONLY when you have encountered a technical error (SQL/Python), fixed it, and want to prevent it from happening again.\n" +
       "   - **DO NOT** use this tool just because the user asks you to 'remember' something. It is for SYSTEM SELF-CORRECTION only, not user notes.\n" +
       "5. **Consensus & Verification (TRIANGULATION)**: \n" +
       "   - **IF** the user asks for a specific metric (e.g., 'What is Q3 Revenue?', 'Count active users'), you **MUST NOT** trust a single tool.\n" +
       "   - **YOU MUST** use `verify_integrity`.\n" +
       "   - **Path A (SQL)**: Provide a `sql_query` that calculates the final answer directly.\n" +
       "   - **Path B (Python)**: \n" +
       "     - Provide a `raw_data_query` to fetch the raw data needed (e.g. 'SELECT * ...').\n" +
       "     - Provide `python_code` to calculate the answer from that data.\n" +
       "     - **CRITICAL**: In your `python_code`, assume a variable `df` (pandas DataFrame) ALREADY EXISTS containing the data from `raw_data_query`. DO NOT try to connect to the DB/DuckDB.\n" +
       "   - If they match (Verdict: VERIFIED):\n" +
       "     1. **MANDATORY**: Call `render_dashboard` with a `stat` widget to visualize the verified number. (e.g. title='Revenue', value='$1M').\n" +
       "     2. Present the result in the text.\n" +
       "   - If they diverge (Verdict: FAILED_TRUTH), trust NEITHER. Investigate why. (e.g. 'Did the Join multiply rows?'). Try again.\n" +
       "6. **Python for Math & Verification**: \\n" +
      "   - NEVER calculate numbers mentally. ALWAYS write Python code.\\n" +
      "   - **MANDATORY VERIFICATION**: You must always write an assertion (test) to prove your result is correct.\\n" +
      "   Example:\\n" +
      "   ```python\\n" +
      "   revenue = df['amount'].sum()\\n" +
      "   # Verification: Revenue cannot be negative\\n" +
      "   assert revenue >= 0, 'Error: Revenue is negative!'\\n" +
      "   # Verification: Check against raw count\\n" +
      "   assert len(df) > 0, 'Error: No data rows found!'\\n" +
      "   print(revenue)\\n" +
      "   ```\\n" +
      "7. **Visible Output (CRITICAL)**: \n" +
       "   - When a tool returns information (e.g., `run_readonly_sql` returns a list of clients), you **MUST COPY AND PASTE** that information explicitly into your final response. \n" +
       "   - **NEVER** say 'I have sent the report' or 'The tool returned the results'. \n" +
       "   - **ALWAYS** show the data. (e.g., 'Here are the clients: [List]').\n" +
       "   - **EXCEPTION for DASHBOARDS**: If you call `render_dashboard`, **DO NOT** convert the data into a Markdown table or list in the text. The Dashboard UI is sufficient. In the text, provide only the *Executive Summary* and *Strategic Insights*.\n" +
      "8. **Output Safety (CRITICAL)**:\\n" +
      "   - Use standard code blocks for examples.\\n" +
      "\\n" +
      "CRITICAL VISUALIZATION RULE:\\n" +
      "IF THE USER ASKS FOR A COMPARISON (e.g., 'US vs DE', 'Client A vs Client B') OR A TREND:\\n" +
      "1. Query the data.\\n" +
      "2. YOU MUST CALL render_dashboard.\\n" +
      "3. **BELOW the dashboard**, you MAY provide a brief text analysis or summary of the key findings.\\n" +
      "4. HOWEVER, DO NOT output the raw data as a text table if it is already in the chart. Avoid redundancy.\\n" +
      "\\n" +
      "OUTPUT STYLE GUIDELINES (CRITICAL):\\n" +
      "- **Tone**: Professional, executive, and high-end. Avoid robotic or dry language. Be concise but insightful.\\n" +
      "- **Formatting**: Use Rich Markdown to create visually stunning reports.\\n" +
      "  - Use **# Headers** to structure the response.\\n" +
      "  - Use **Markdown Tables** for data comparisons.\\n" +
      "  - Use **Bold** for key figures (e.g., **$124,500.00**).\\n" +
      "  - Use > Blockquotes for insights or key takeaways.\\n" +
      "- **Structure**:\\n" +
      "  1. **Executive Summary**: A 1-sentence bottom-line up front.\\n" +
      "  2. **Detailed Analysis**: structured data, tables, and evidence.\\n" +
      "  3. **Strategic Insight**: A 'So What?' conclusion or recommendation.\\n" +
      "\\n" +
      "Your goal is to wow the user with both your intelligence and your presentation.";

export type AgentEvent = 
  | { type: 'text', content: string }
  | { type: 'thought', content: string }
  | { type: 'tool_call', name: string, args: any }
  | { type: 'tool_result', name: string, result: any }
  | { type: 'error', error: string };

export class AgentCore {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey: apiKey });
  }

  async *streamChat(message: string, history: any[] = []): AsyncGenerator<AgentEvent> {
    
    // 1. ACTIVE RECALL: Load Memory & Context
    let contextInjection = "";
    try {
        const knowledgeDir = path.join(process.cwd(), 'knowledge');
        const memoryContent = await fs.readFile(path.join(knowledgeDir, 'agent_memory.md'), 'utf-8');
        const schemaContent = await fs.readFile(path.join(knowledgeDir, 'database_schema.md'), 'utf-8');
        const rulesContent = await fs.readFile(path.join(knowledgeDir, 'business_rules.md'), 'utf-8');

        if (memoryContent || schemaContent || rulesContent) {
            contextInjection = `\n\n[SYSTEM INJECTION: ACTIVE CONTEXT]\nThe following files are pre-loaded into your context. DO NOT call read_file for them again.\n\n` +
                                `=== DATABASE SCHEMA ===\n${schemaContent}\n\n` +
                                `=== BUSINESS RULES ===\n${rulesContent}\n\n` +
                                `=== AGENT MEMORY (LESSONS) ===\n${memoryContent}\n` +
                                `[END INJECTION]\n\n`;
        }
    } catch (e) {
        console.warn("Could not load knowledge for context injection", e);
    }
    
    const finalMessage = contextInjection + message;
    
    // Convert 'history' arg (which might be in old format) to new SDK 'Content' format if needed.
    // Assuming Frontend passes a compatible history or we treat 'history' as just PREVIOUS turns.
    // We will construct the `contents` array for this turn.
    
    const contents: any[] = [
        { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
        ...history, // Assume history items are { role: ..., parts: ... } compatible
        { role: 'user', parts: [{ text: finalMessage }] }
    ];

    let currentTurnComplete = false;
    // We keep track of local history for this streaming session (multishot loops)
    let sessionHistory = [...contents];

    try {
        // 0. VISUALIZATION: Emit synthetic tool call for Implicit Context Access
        if (contextInjection) {
             yield { 
                 type: 'tool_call', 
                 name: 'access_knowledge_context', 
                 args: { memory: 'active', schema: 'loaded', rules: 'active' } 
             } as AgentEvent;
             
             // Short delay to let the UI render the "Running" state momentarily (optional, but feels more organic)
             await new Promise(r => setTimeout(r, 600));

             yield { 
                 type: 'tool_result', 
                 name: 'access_knowledge_context', 
                 result: 'Success: Active Context loaded and validated.' 
             } as AgentEvent;
        }

        while (!currentTurnComplete) {
            const result = await this.ai.models.generateContentStream({
                model: "gemini-3-pro-preview",
                contents: sessionHistory,
                config: {
                    tools: tools,
                    systemInstruction: SYSTEM_PROMPT, // Redundant but safe
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.HIGH
                    }
                }
            });

            let buffer = '';
            let isInThinkingBlock = false;
            // Store whole part structure: { functionCall: ..., thoughtSignature?: ... }
            let currentFunctionCalls: any[] = [];
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            let fullText = '';
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            let fullThoughts = '';

            // Consume the stream
            for await (const chunk of result) {
                // New SDK chunk structure
                const candidate = chunk.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                
                // DEBUG: Inspect raw parts
                if (parts.length > 0) {
                    console.log('RAW PARTS:', JSON.stringify(parts, null, 2));
                }

                // 1. Text & Thoughts
                const textParts = parts.filter((p:any) => p.text);
                for (const part of textParts) {
                    const text = part.text || '';
                    if (text) {
                        buffer += text;
                        fullText += text;
                        // Gemini 3: Thoughts are hidden/encrypted. We stream text directly.
                        yield { type: 'text', content: text } as AgentEvent;
                    }
                }

                // 2. Function Calls (usually in final chunks)
                const callParts = parts.filter((p:any) => p.functionCall);
                for (const part of callParts) {
                    const fnCall = part.functionCall;
                    if (fnCall) {
                        // Capture thoughtSignature if present
                        // @ts-ignore
                        const thoughtSig = part.thoughtSignature;
                        currentFunctionCalls.push({ 
                            functionCall: fnCall,
                            thoughtSignature: thoughtSig 
                        });
                        yield { type: 'tool_call', name: fnCall.name, args: fnCall.args } as AgentEvent;
                    }
                }
            }
            
            // Flush buffer
            if (buffer) {
                 yield { type: isInThinkingBlock ? 'thought' : 'text', content: buffer } as AgentEvent;
            }

            // CRITICAL: Push Model Response to History
            // We construct the content manually since result.response is not available in AsyncGenerator
            const finalParts: any[] = [];
            if (fullText) {
                finalParts.push({ text: fullText });
            }
            for (const callObj of currentFunctionCalls) {
                const part: any = { functionCall: callObj.functionCall };
                if (callObj.thoughtSignature) {
                    part.thoughtSignature = callObj.thoughtSignature;
                }
                finalParts.push(part);
            }

            if (finalParts.length > 0) {
                 sessionHistory.push({ role: "model", parts: finalParts });
            }

            if (currentFunctionCalls.length > 0) {
                 // Execute Tools
                 const functionResponses: any[] = [];
                 
                 for (const callObj of currentFunctionCalls) {
                     const call = callObj.functionCall;
                     let toolResult;
                     if (toolMap[call.name]) {
                        try {
                            toolResult = await toolMap[call.name](call.args);
                        } catch (error: any) {
                            toolResult = `Error: ${error.message}`;
                        }
                     } else {
                         toolResult = 'Tool not found';
                     }
                     
                     // Yield result
                     let displayResult = toolResult;
                     if (typeof displayResult === 'object') displayResult = JSON.stringify(displayResult);
                     if (typeof displayResult === 'string' && displayResult.length > 2000) displayResult = displayResult.substring(0, 2000) + '...';
                     yield { type: 'tool_result', name: call.name, result: displayResult } as AgentEvent;

                     functionResponses.push({
                         functionResponse: {
                             name: call.name,
                             response: { content: toolResult }
                         }
                     });
                 }

                 // Add tool output to history
                 sessionHistory.push({ role: "tool", parts: functionResponses });
                 
                 // Loop continues...
            } else {
                currentTurnComplete = true;
            }
        }
    } catch (error: any) {
        console.error("Stream Error", error);
        yield { type: 'error', error: error.message };
    }
  }
}

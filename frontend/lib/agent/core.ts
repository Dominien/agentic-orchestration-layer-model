import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
  [runPythonToolDefinition.name]: runPythonTool,
  [render_dashboard.name]: renderDashboardTool,
  [addLearnedLessonToolDefinition.name]: addLearnedLessonTool,
  [triangulationToolDefinition.name]: triangulationTool,
};

const tools = [
  {
    functionDeclarations: [
      {
        name: readFileToolDefinition.name,
        description: readFileToolDefinition.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
             filename: {
               type: SchemaType.STRING,
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
          type: SchemaType.OBJECT,
          properties: {
             query: {
               type: SchemaType.STRING,
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
           type: SchemaType.OBJECT,
           properties: {
              code: {
                type: SchemaType.STRING,
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
            type: SchemaType.OBJECT,
            properties: {
               lesson: {
                 type: SchemaType.STRING,
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
             type: SchemaType.OBJECT,
             properties: {
                sql_query: {
                  type: SchemaType.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.sql_query.description
                },
                raw_data_query: {
                  type: SchemaType.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.raw_data_query.description
                },
                python_code: {
                  type: SchemaType.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.python_code.description
                },
                metric_name: {
                  type: SchemaType.STRING,
                  description: triangulationToolDefinition.inputSchema.shape.metric_name.description
                }
             },
             required: ['sql_query', 'raw_data_query', 'python_code', 'metric_name']
           }
        }
     ]
  }
];

const _separator = 0;

const SYSTEM_PROMPT = "You are an elite autonomous AI Orchestrator providing high-end business intelligence.\\n" +
      "\\n" +
      "CORE BEHAVIORS:\\n" +
      "1. **Thinking First (CRITICAL)**: Before calling any tool, you must generate a <thinking> block. Inside this block:\\n" +
      "   a. Break down the user's request.\\n" +
      "   b. List the tools you intend to use.\\n" +
      "   c. Hypothesize potential errors (e.g., 'If the tax column is null, I need to filter it').\\n" +
      "   Only THEN execute the tool.\\n" +
      "   Example:\\n" +
      "   <thinking>\\n" +
      "   User asked for revenue comparison.\\n" +
      "   1. I need to check the schema for client industries.\\n" +
      "   2. I must check 'business_rules.md' for specific calculation logic.\\n" +
      "   3. This is a comparison, so I MUST use 'render_dashboard'.\\n" +
      "   Potential Error: The client name might be misspelled. I'll use ILIKE.\\n" +
      "   </thinking>\\n" +
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
      "7. **Silent Execution (CRITICAL)**: \\n" +
      "   - **DO NOT** narrate your plan to the user (e.g., 'I will now query the database...', 'Start by reading...'). \\n" +
      "   - **KEEP ALL PLANNING INSIDE <thinking> BLOCKS.**\\n" +
      "   - **IMMEDIATE ACTION**: You must execute the tool **IMMEDIATELY** after the '</thinking>' closing tag. Do not pause. Do not output text between relevant thinking and the tool.\\n" +
      "   - The **Text Output** is ONLY for the **Final Answer** or **Executive Report**. \\n" +
      "   - Your response should look like:\\n" +
      "     <thinking>Plan...</thinking>\\n" +
      "     [Tool Call]\\n" +
      "     <reflection>Reflection...</reflection>\\n" +
      "     [Tool Call]\\n" +
      "     <reflection>\n" +
      "     LOGIC CHECK:\n" +
      "     - Did the tool output match the request?\n" +
      "     - Is the number sensible?\n" +
      "     - If NO: I must correct it.\n" +
      "     </reflection>\n" +
      "     [Tool Call (Correction)]\n" +
      "     <reflection>\n" +
      "     MEMORY TRIGGER:\n" +
      "     - Did I encounter a tool error (e.g. SQL Security Error) and fix it?\n" +
      "     - If YES: I MUST call `add_learned_lesson` NOW to save this fix.\n" +
      "     - Lesson Format: \"Problem: [Error] -> Solution: [Fix]\"\n" +
      "     </reflection>\n" +
      "     [add_learned_lesson]\n" +
      "     [Final Report with Dashboard]\\n" +
      "7. **Visible Output (CRITICAL)**: \n" +
       "   - When a tool returns information (e.g., `run_readonly_sql` returns a list of clients), you **MUST COPY AND PASTE** that information explicitly into your final response. \n" +
       "   - **NEVER** say 'I have sent the report' or 'The tool returned the results'. \n" +
       "   - **ALWAYS** show the data. (e.g., 'Here are the clients: [List]').\n" +
       "   - **EXCEPTION for DASHBOARDS**: If you call `render_dashboard`, **DO NOT** convert the data into a Markdown table or list in the text. The Dashboard UI is sufficient. In the text, provide only the *Executive Summary* and *Strategic Insights*.\n" +
      "8. **Output Safety (CRITICAL)**:\\n" +
      "   - If you are explaining your own architecture or giving examples of thinking, **NEVER** use the literal tags <thinking> or <reflection> in your output text.\\n" +
      "   - The UI parser will mistake them for real valid control tokens and break the display.\\n" +
      "   - Instead, use: 'Thinking Block', 'Reflection Tag', or use standard code blocks for examples.\\n" +
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
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      tools: tools as any,
      systemInstruction: SYSTEM_PROMPT
    });
  }

  async *streamChat(message: string, history: any[] = []): AsyncGenerator<AgentEvent> {
    
    // 1. ACTIVE RECALL: Load Memory & Context
    // We force the agent to "remember" by injecting key files into the prompt.
    // This solves "files already read" redundancy and Schema Hallucinations (e.g. dim_clients).
    let contextInjection = "";
    try {
        const knowledgeDir = path.join(process.cwd(), 'knowledge');
        
        // Load Memory
        const memoryContent = await fs.readFile(path.join(knowledgeDir, 'agent_memory.md'), 'utf-8');
        
        // Load Schema & Rules (Critical for Logic)
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
    
    // Prepend memory AND a strict thinking trigger to the user message
    // Gemini 3 tends to optimize away thinking. We force it back with a strict SYSTEM block.
    const thinkingTrigger = `\n\n[SYSTEM]: You are in "SYSTEM 2" Mode. You MUST output a <thinking> block before calling any tools. \n<thinking>\n- Plan\n- Hypothesis\n- Verification Strategy\n</thinking>\n\n(Proceed to Tool Call)\n\n`;
    const finalMessage = contextInjection + thinkingTrigger + message;

    const chat = this.model.startChat({
        history: history
    });

    // Helper to process a stream result
    const processStreamResult = async function* (result: any, toolMap: any) {
         let isInThinkingBlock = false;
         let buffer = '';

         // Iterate through the stream chunks
         for await (const chunk of result.stream) {
            
            // 1. Handle Tool Calls (functionCalls)
            // Note: In streaming, function calls usually come in a chunk where text() is empty or separate.
            // We need to check both.
            const calls = chunk.functionCalls();
            if (calls && calls.length > 0) {
                 for (const call of calls) {
                     yield { type: 'tool_call', name: call.name, args: call.args } as AgentEvent;
                 }
                 // Do not continue; allow fall-through to check for text() in the same chunk
            }

            // 2. Handle Text Content with <thinking> parsing
            try {
                const text = chunk.text();
                if (text) {
                    buffer += text;
                    
                    // Simple state machine for parsing <thinking> and <reflection> tags
                    while (true) {
                        if (!isInThinkingBlock) {
                            // Find the earliest occurrence of either tag
                            const thinkingStart = buffer.indexOf('<thinking>');
                            const reflectionStart = buffer.indexOf('<reflection>');
                            
                            let startTagIndex = -1;
                            let activeTag = '';

                            if (thinkingStart !== -1 && (reflectionStart === -1 || thinkingStart < reflectionStart)) {
                                startTagIndex = thinkingStart;
                                activeTag = '<thinking>';
                            } else if (reflectionStart !== -1) {
                                startTagIndex = reflectionStart;
                                activeTag = '<reflection>';
                            }

                            if (startTagIndex !== -1) {
                                // Flush text before tag
                                if (startTagIndex > 0) {
                                    yield { type: 'text', content: buffer.substring(0, startTagIndex) } as AgentEvent;
                                }
                                // Enter thinking mode
                                isInThinkingBlock = true;
                                // We might want to preserve the tag type for the UI, but for now map both to 'thought'
                                // To make them distinct in the UI, we could prefix the content
                                const prefix = activeTag === '<reflection>' ? '[REFLECTION] ' : '';
                                if (prefix) {
                                    yield { type: 'thought', content: prefix } as AgentEvent;
                                }
                                
                                buffer = buffer.substring(startTagIndex + activeTag.length);
                            } else {
                                // No start tag found yet
                                if (!buffer.includes('<')) {
                                     yield { type: 'text', content: buffer } as AgentEvent;
                                     buffer = '';
                                     break; 
                                } else {
                                     // Has '<', might be start of tag. 
                                     if (buffer.length > 50) {
                                         yield { type: 'text', content: buffer } as AgentEvent;
                                         buffer = '';
                                     }
                                     break;
                                }
                            }
                        } else {
                            // In Thinking/Reflection Block
                            // We need to look for BOTH closing tags since we don't track which one we're in strictly here (simplification)
                            // A better state machine would track `currentTagType`.
                            // Let's assume the model doesn't nest them wrong.
                            
                            const thinkingEnd = buffer.indexOf('</thinking>');
                            const reflectionEnd = buffer.indexOf('</reflection>');
                            
                            let endTagIndex = -1;
                            let closingTagLen = 0;

                            if (thinkingEnd !== -1 && (reflectionEnd === -1 || thinkingEnd < reflectionEnd)) {
                                endTagIndex = thinkingEnd;
                                closingTagLen = '</thinking>'.length;
                            } else if (reflectionEnd !== -1) {
                                endTagIndex = reflectionEnd;
                                closingTagLen = '</reflection>'.length;
                            }

                            if (endTagIndex !== -1) {
                                // Flush thought content
                                if (endTagIndex > 0) {
                                    yield { type: 'thought', content: buffer.substring(0, endTagIndex) } as AgentEvent;
                                }
                                // Exit thinking mode
                                isInThinkingBlock = false;
                                buffer = buffer.substring(endTagIndex + closingTagLen);
                            } else {
                                // No ending tag found in this buffer.
                                // CRITICAL CHECK: The end of the buffer might contain a partial closing tag (e.g. "</thin").
                                // We must NOT flush that part. We keep a safe "tail" to handle split tags across chunks.
                                const safeTail = 20; // Sufficient for </thinking> or </reflection>
                                
                                if (buffer.length > safeTail) {
                                    const splitIndex = buffer.length - safeTail;
                                    const safeContent = buffer.substring(0, splitIndex);
                                    
                                    yield { type: 'thought', content: safeContent } as AgentEvent;
                                    buffer = buffer.substring(splitIndex); // Keep the tail
                                }
                                // If buffer is short, we yield nothing yet and wait for more chunks.
                                break;
                            }
                        }
                    }
                    
                    // CLEANUP: Remove any rogue <analysis> tags if they appear in the final text
                    // This is a simple string replacement on the buffer before it is yielded as text
                    if (!isInThinkingBlock && buffer.includes('<analysis>')) {
                        buffer = buffer.replace(/<analysis>/g, '').replace(/<\/analysis>/g, '');
                    }
                }
            } catch (e) {
                // Ignore text() errors if chunk has no text (e.g. only function call)
            }
         }
         
         // Flush remaining buffer
         if (buffer) {
             yield { type: isInThinkingBlock ? 'thought' : 'text', content: buffer } as AgentEvent;
         }
    };

    try {
        let result = await chat.sendMessageStream(finalMessage);
        
        // We need to collect tool calls to execute them after the text stream finishes (turn-based)
        // OR execute them as they come?
        // Gemini pro: typically sends text first (reasoning), then function calls.
        // We capture function calls from the aggregated response to be safe and avoid partial args.
        
        // Pass 1: Stream text and thoughts to user
        let accumulatedText = '';
        
        // We must iterate the stream to drive it
        for await (const event of processStreamResult(result, toolMap)) {
            yield event; // Forward events to frontend
        }

        // Pass 2: Check for tool calls in the FINAL aggregated response object
        let response = await result.response;
        let functionCalls = response.functionCalls();

        // Loop to handle multiple function calls (ReAct loop)
        // Note: The previous stream loop finished the *first* turn. Now we handle tools.
        let currentFunctionCalls = functionCalls;
        
        // We need a loop similar to the previous implementation, but using streaming for the "Assistant Response" parts
        // The first turn is already streamed above. Now we check if we need to recurse.
        
        while (currentFunctionCalls && currentFunctionCalls.length > 0) {
            
            const results = [];
            for (const call of currentFunctionCalls) {
                 // Removed redundant yield to prevent duplicate logs
                 
                 let toolResult;
                 if (toolMap[call.name]) {
                    try {
                        toolResult = await toolMap[call.name](call.args);
                    } catch (error: any) {
                        toolResult = `Error: ${error.message}\n\nThe tool returned an error. Before trying again, analyze the error message in a <reflection> block. What went wrong? Was the column name wrong? Check the schema again. Then generate the corrected query.`;
                    }
                 } else {
                     toolResult = 'Tool not found';
                 }
                 
                 // Yield result to frontend
                 let displayResult = toolResult;
                 if (typeof displayResult === 'object') displayResult = JSON.stringify(displayResult);
                 if (typeof displayResult === 'string' && displayResult.length > 2000) displayResult = displayResult.substring(0, 2000) + '...';
                 yield { type: 'tool_result', name: call.name, result: displayResult } as AgentEvent;

                 results.push({
                     functionResponse: {
                         name: call.name,
                         response: { content: toolResult }
                     }
                 });
            }

            // 2. Send usage back to model and STREAM the response
            const nextResult = await chat.sendMessageStream(results);
            
            // Stream the NEXT explanation/response
            for await (const event of processStreamResult(nextResult, toolMap)) {
                yield event;
            }
            
            // Check for more calls
            const nextResponse = await nextResult.response;
            currentFunctionCalls = nextResponse.functionCalls();
        }

    } catch (error: any) {
        console.error('Agent Error:', error);
        yield { type: 'error', error: error.message || 'Unknown error occurred' };
    }
  }
}


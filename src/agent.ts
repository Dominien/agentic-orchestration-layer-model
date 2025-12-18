import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { readFileTool, readFileToolDefinition } from './tools/read_file_tool';
import { runReadonlySqlTool, runReadonlySqlToolDefinition } from './tools/run_readonly_sql_tool';
import { runPythonTool, runPythonToolDefinition } from './tools/run_python_tool';
import { render_dashboard, renderDashboardTool } from './tools/dashboard_tool';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Define tools for Gemini
// The new SDK accepts tools as an array of tool objects.
const tools = [
  {
    functionDeclarations: [
      {
        name: readFileToolDefinition.name,
        description: readFileToolDefinition.description,
        parameters: {
          type: Type.OBJECT, // String "OBJECT" is safer than SchemaType enum if enum differs
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
       }
    ]
  }
];

// Map tool names to functions
const toolMap: Record<string, Function> = {
  [readFileToolDefinition.name]: readFileTool,
  [runReadonlySqlToolDefinition.name]: runReadonlySqlTool,
  [runPythonToolDefinition.name]: runPythonTool,
  [render_dashboard.name]: renderDashboardTool,
};

const SYSTEM_PROMPT = "You are an autonomous orchestrator. You do not know the DB schema or rules initially. You must read the documentation in `/knowledge` first. specifically `database_schema.md`, `business_rules.md`, AND `visualization_capabilities.md` to understand your capabilities. usage of `visualization_capabilities.md` is MANDATORY for any data request.";

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // History management
  const history: any[] = [
      { role: "system", parts: [ { text: SYSTEM_PROMPT } ] }
      // NOTE: Some API versions expect system instruction in config, others in history. 
      // The new SDK usually takes config.systemInstruction. I'll put it there too to be safe.
  ];

  console.log("Agent started (Gemini 3 Native). Type your request (or 'exit' to quit):");
  
  const askQuestion = () => {
    rl.question('> ', async (userInput) => {
      if (userInput.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        // Add user message to history
        history.push({ role: "user", parts: [{ text: userInput }] });

        let currentTurnComplete = false;
        
        while (!currentTurnComplete) {
            
            // Call Model
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: history,
                config: {
                    tools: tools,
                    systemInstruction: SYSTEM_PROMPT, 
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.HIGH
                    }
                }
            });

            // Get response
            // The new SDK response structure:
            // response.candidates[0].content.parts...
            // It might also have helper methods like response.functionCalls()?
            // We'll inspect the raw structure to be safe or use helpers if available.
            
            const candidate = response.candidates?.[0];
            const content = candidate?.content;
            const parts = content?.parts || [];

            // Add model response to history
            // CRITICAL: We must push the EXACT content object to preserve thoughtSignature if present in metadata/parts
            history.push(content);

            // Log thoughts if hidden (debug)
            // @ts-ignore
            if (candidate?.thoughtSignature) {
                // @ts-ignore
                console.log(`[System] Captured thoughtSignature: ${candidate.thoughtSignature.substring(0,20)}...`);
            }

            // Check for function calls
            const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);

            if (functionCalls.length > 0) {
                 const functionResponses: any[] = [];

                 // Execute tools
                 await Promise.all(functionCalls.map(async (call: any) => {
                    const toolName = call.name;
                    const toolArgs = call.args;
                    console.log(`[Agent] Calling tool: ${toolName}`, toolArgs);

                    let toolResult;
                    if (toolMap[toolName]) {
                        try {
                            toolResult = await toolMap[toolName](toolArgs);
                        } catch (error: any) {
                            toolResult = `Error executing ${toolName}: ${error.message}`;
                        }
                    } else {
                        toolResult = `Error: Tool ${toolName} not found.`;
                    }

                    console.log(`[Agent] Tool output:`, typeof toolResult === 'string' ? toolResult.substring(0, 500) + '...' : toolResult);
                    
                    functionResponses.push({
                        functionResponse: {
                            name: toolName,
                            response: { content: toolResult }
                        }
                    });
                 }));

                 // We need to order responses? Standard API usually matches by ID or order.
                 // We'll just push all responses.
                 
                 // Add function responses to history
                 history.push({ role: "tool", parts: functionResponses });
                 
                 // Loop continues (Re-Act)
            } else {
                 // No function calls, just text. Turn complete.
                 const text = parts.filter(p => p.text).map(p => p.text).join('');
                 console.log(`[Agent]: ${text}`);
                 currentTurnComplete = true;
            }
        }

      } catch (error) {
        console.error('Error in agent loop:', error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main();

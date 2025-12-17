import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Define tools for Gemini
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

async function main() {
  const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      tools: tools,
      systemInstruction: "You are an autonomous orchestrator. You do not know the DB schema or rules initially. You must read the documentation in `/knowledge` first. specifically `database_schema.md`, `business_rules.md`, AND `visualization_capabilities.md` to understand your capabilities. usage of `visualization_capabilities.md` is MANDATORY for any data request."
  });

  const chat = model.startChat();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("Agent started. Type your request (or 'exit' to quit):");
  
  const askQuestion = () => {
    rl.question('> ', async (userInput) => {
      if (userInput.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        let result = await chat.sendMessage(userInput);
        let response = await result.response;
        let functionCalls = response.functionCalls();

        // Loop to handle multiple function calls until the model answers strictly with text
        while (functionCalls && functionCalls.length > 0) {
            
            // Execute all function calls requested by the model
            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
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

                console.log(`[Agent] Tool output:`, typeof toolResult === 'string' ? toolResult.substring(0, 5000) + '...' : toolResult);
                
                return {
                    functionResponse: {
                        name: toolName,
                        response: {
                           content: toolResult
                        }
                    }
                };
            }));

            // Send tool results back to the model
            result = await chat.sendMessage(functionResponses);
            response = await result.response;
            functionCalls = response.functionCalls();
        }

        console.log(`[Agent]: ${response.text()}`);

      } catch (error) {
        console.error('Error in agent loop:', error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main();

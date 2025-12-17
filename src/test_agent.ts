import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { readFileTool, readFileToolDefinition } from './tools/read_file_tool';
import { runReadonlySqlTool, runReadonlySqlToolDefinition } from './tools/run_readonly_sql_tool';
import { runPythonTool, runPythonToolDefinition } from './tools/run_python_tool';

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
       }
    ]
  }
];

// Map tool names to functions
const toolMap: Record<string, Function> = {
  [readFileToolDefinition.name]: readFileTool,
  [runReadonlySqlToolDefinition.name]: runReadonlySqlTool,
  [runPythonToolDefinition.name]: runPythonTool,
};

async function main() {
  const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      tools: tools,
      systemInstruction: "You are an autonomous orchestrator. You do not know the DB schema or rules initially. You must read the documentation in `/knowledge` first. You never calculate numbers yourself; you use Python tools for that."
  });

  const chat = model.startChat();
  const userInput = "Calculate the total revenue for the client 'Stark Industries' (fuzzy match) based on unbilled hours, applying the correct tax rate from the rules.";

  console.log(`Sending Prompt: ${userInput}`);

  try {
    let result = await chat.sendMessage(userInput);
    let response = await result.response;
    let functionCalls = response.functionCalls();

    let loopCount = 0;
    while (functionCalls && functionCalls.length > 0 && loopCount < 10) {
        loopCount++;
        console.log(`--- Turn ${loopCount} ---`);
        
        // Execute all function calls requested by the model
        const functionResponses = await Promise.all(functionCalls.map(async (call) => {
            const toolName = call.name;
            const toolArgs = call.args;
            
            console.log(`[Agent] Calling tool: ${toolName}`, JSON.stringify(toolArgs));
            
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

            console.log(`[Agent] Tool output:`, typeof toolResult === 'string' ? toolResult.substring(0, 100) + '...' : toolResult);
            
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
}

main();

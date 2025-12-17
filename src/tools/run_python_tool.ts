import CodeInterpreter from '@e2b/code-interpreter';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.E2B_API_KEY) {
  throw new Error('Missing E2B_API_KEY');
}

export const runPythonToolDefinition = {
  name: 'run_python',
  description: 'Execute a Python script in a secure sandbox. Use this for math, data processing, and formatted output.',
  inputSchema: z.object({
    code: z.string().describe('The Python code to execute.'),
  }),
};

export async function runPythonTool(args: z.infer<typeof runPythonToolDefinition.inputSchema>) {
  console.log('Running Python code...');
  
  try {
    const sandbox = await CodeInterpreter.create({
        apiKey: process.env.E2B_API_KEY
    });
    
    // Execute the code
    const execution = await sandbox.runCode(args.code);
    
    let output = '';
    
    // execution.text is a getter that returns the main result text
    if (execution.text) {
        output += `Standard Output:\n${execution.text}\n`;
    }
    
    // Check for logs (stdout/stderr)
    if (execution.logs.stdout.length > 0) {
         output += `Logs:\n${execution.logs.stdout.join('\n')}\n`;
    }

    if (execution.results && execution.results.length > 0) {
        output += `Results:\n${execution.results.map((r: any) => r.text).join('\n')}\n`;
    }
    
    if (execution.error) {
        output += `Error:\n${execution.error.name}: ${execution.error.value}\n${execution.error.traceback}\n`;
    }
    
    await sandbox.kill();
    
    return output || 'No output returned.';
    
  } catch (error: any) {
    return `Sandbox Error: ${error.message}`;
  }
}

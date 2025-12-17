import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export const readFileToolDefinition = {
  name: 'read_file',
  description: 'Read a markdown documentation file from the /knowledge directory.',
  inputSchema: z.object({
    filename: z.string().describe('The name of the file to read (e.g., "database_schema.md" or "business_rules.md").'),
  }),
};

export async function readFileTool(args: z.infer<typeof readFileToolDefinition.inputSchema>) {
  // Next.js (and general Node) friendly path resolution
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

  const filePath = path.join(KNOWLEDGE_DIR, args.filename);

  // Security check: ensure the file is within the knowledge directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(KNOWLEDGE_DIR)) {
    throw new Error('Access denied: Can only read files from the knowledge directory.');
  }

  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return content;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `Error: File "${args.filename}" not found in knowledge directory. Available files: ${await fs.readdir(KNOWLEDGE_DIR)}`;
    }
    throw error;
  }
}

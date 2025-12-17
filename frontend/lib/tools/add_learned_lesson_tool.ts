import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export const addLearnedLessonToolDefinition = {
  name: 'add_learned_lesson',
  description: 'Writes a "Learned Lesson" to the permanent agent memory (knowledge/agent_memory.md). Use this tool AFTER successfully resolving a complex error to prevent future recurrence.',
  inputSchema: z.object({
    lesson: z.string().describe('The lesson to record. format: "## [Topic]\n- **Problem**: ...\n- **Solution**: ..."'),
  }),
};

export async function addLearnedLessonTool(args: z.infer<typeof addLearnedLessonToolDefinition.inputSchema>) {
  const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
  const MEMORY_FILE = path.join(KNOWLEDGE_DIR, 'agent_memory.md');

  // Create formatted entry
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const entry = `\n\n### [Learned ${timestamp}]\n${args.lesson}`;

  try {
    // Append to file
    await fs.appendFile(MEMORY_FILE, entry, 'utf-8');
    return `Successfully recorded lesson to agent_memory.md.`;
  } catch (error: any) {
    return `Error writing to memory: ${error.message}`;
  }
}

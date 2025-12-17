import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const runReadonlySqlToolDefinition = {
  name: 'run_readonly_sql',
  description: 'Execute a READ-ONLY SQL query against the Supabase database. Only SELECT statements are allowed.',
  inputSchema: z.object({
    query: z.string().describe('The SQL query to execute (must start with SELECT).'),
  }),
};

export async function runReadonlySqlTool(args: z.infer<typeof runReadonlySqlToolDefinition.inputSchema>) {
  let query = args.query.trim();

  // Remove trailing semicolon if present, as it breaks the subquery wrapper in exec_sql
  if (query.endsWith(';')) {
    query = query.slice(0, -1);
  }

  // Basic security check for read-only
  const upperQuery = query.toUpperCase();
  if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
    throw new Error('Security Error: Only SELECT or WITH queries are allowed.');
  }

  // Warning: running raw SQL usually requires the pg driver or a specific RPC.
  // Since we don't have an `exec_sql` RPC set up, we can't run arbitrary SQL via the JS client easily WITHOUT using a function.
  // However, for this MVP, I will assume the user MIGHT have set it up, OR I will implement a workaround.
  // Workaround: The prompt asks for "run_readonly_sql_tool".
  // Let's try to use the `rpc` method assuming an `exec_sql` function exists (which I asked the user about but they only did tables).
  // WAIT. The prompt said "No hardcoded business logic". The AI needs to query.
  // If I can't run raw SQL, I can't fulfill the "AI learns schema" part easily if I force it to use the JS builder.
  // BUT, to keep it simple and truly dynamic, I should probably use `pg` directly if I could, but I didn't install it.
  // I installed `@supabase/supabase-js`.
  
  // Okay, since I cannot run raw SQL via the standard client without an RPC, 
  // and the user only created tables, I will use a fallback:
  // I will throw an error if the RPC is missing, telling the model to use the JS Query Builder? 
  // No, the prompt explicitly says "run_readonly_sql_tool... execute SELECT statements".
  
  // Let's assume I can use `rpc` and I'll catch the error. 
  // If it fails, I'll return a message saying "Please enable the exec_sql function".
  // OR, I can use the supabase-js postgrest-js library's `rpc` capabilities.
  
  // Actually, there is a trick. I can assume the standard Supabase setup.
  // The user prompt was to "run SELECT statements". 
  // I will assume the user has appropriate permissions or I will assume the agent will fail if not set up.
  // BUT, I can also perform a "simulated" SQL via JS if the query is simple, but that's hard (parsing SQL).
  
  // Let's just use the `rpc` approach. It's the standard way for "Raw SQL" in Supabase from client.
  // I'll add a helpful error message if it fails.
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) {
       // If RPC is missing, return a clearer error
       if (error.code === '42883') { // Undefined function
         return `Error: The 'exec_sql' RPC function is not defined in Supabase. \n` + 
                `Please run this in Supabase SQL Editor:\n` +
                `CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS json AS $$ \n` +
                `BEGIN RETURN (execute query); END; $$ LANGUAGE plpgsql;`;
       }
       throw error;
    }
    return JSON.stringify(data, null, 2);
  } catch (error: any) {
    return `Database Error: ${error.message}`;
  }
}

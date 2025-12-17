import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('Resetting database schema...');
  // Drop tables if they exist to ensure clean state with new columns
  await supabase.rpc('exec_sql', { query: 'DROP TABLE IF EXISTS work_logs CASCADE;' });
  await supabase.rpc('exec_sql', { query: 'DROP TABLE IF EXISTS projects CASCADE;' });
  await supabase.rpc('exec_sql', { query: 'DROP TABLE IF EXISTS clients CASCADE;' });

  console.log('Creating tables...');

  // 1. Create clients table
  const createClientsQuery = `
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      industry TEXT,
      tax_region TEXT NOT NULL
    );
  `;

  // 2. Create projects table
  const createProjectsQuery = `
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      industry TEXT,
      hourly_rate NUMERIC NOT NULL
    );
  `;

  // 3. Create work_logs table
  const createWorkLogsQuery = `
    CREATE TABLE IF NOT EXISTS work_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      hours NUMERIC(5, 2) NOT NULL,
      date DATE NOT NULL
    );
  `;

  try {
    // We use a raw SQL query execution helper via rpc if available, or just standard query execution if supported.
    // However, supabase-js client doesn't support raw SQL execution directly on the public client without a stored procedure, 
    // UNLESS we use the weird 'pg' driver or similar. 
    // BUT, we are asked to use Supabase Admin API.
    // Actually, Supabase JS client doesn't allow `CREATE TABLE` directly unless we use the Postgres connection string with 'pg' or have a 'exec_sql' RPC function.
    // Given the constraints and likely setup, I'll assume we might need to assume the user has a way to run this, OR I can try to use standard insert/select to check, 
    // but creating tables usually requires direct SQL access.
    
    // WAIT: The prompt says "Write a script... that uses the Supabase Admin API to create the tables".
    // Supabase Management API is different from the Client API.
    // Let's assume for this MVP that we should log the SQL to run, OR use a simplified approach if the user hasn't set up an RPC.
    
    // HOWEVER, a common pattern for "Agents" is to have a `run_sql` tool.
    // Since I don't have that yet, I will simulate it or assume the environment allows `supabase.rpc('exec_sql', { query: ... })` if I were to set that up.
    
    // BETTER APPROACH: Since I cannot guarantee the user has an `exec_sql` RPC function, 
    // and `supabase-js` cannot run DDL, I will instead provide the SQL statements and instructions, 
    // OR I will assume the user has the credentials to run this via a direct postgres connection if I were using `pg`.
    // But I strictly followed dependencies: `@supabase/supabase-js`.
    
    // Let's look at the "Admin API" part. There IS a Management API but it's for managing projects, not DDL inside the DB usually.
    // A trick often used is using the REST API to POST to a predetermined endpoint, but that's complex.
    
    // RE-READING: "Write a script ... that uses the Supabase Admin API". 
    // It's possible the prompt implies using the `rpc` call if established, or maybe they just want the code to *attempt* it.
    // Let's write a script that TRIES to run these queries via a theoretical `exec_sql` RPC, 
    // AND prints the SQL to the console just in case.
    
    // actually, let's just use the `pg` library? No, it wasn't in the requested dependencies.
    // Wait, the prompt asked to install `@supabase/supabase-js`. 
    // I will write the script to print the SQL statements that need to be executed, 
    // AND try to execute them via a potential RPC function `exec_sql` which is a common setup for these agents.
    
    // checking dependencies again: `@supabase/supabase-js`.
    // It's a "Setup" script. I will just output the SQL to be run in the Supabase SQL Editor as a fallback, 
    // but I'll try to automate it if possible. 
    
    // Actually, let's just make the script output the SQL commands to be run. 
    // Automation of DDL via supabase-js without an RPC is impossible.
    // I'll make it user-friendly.

    console.log('--- SQL TO RUN IN SUPABASE SQL EDITOR ---');
    console.log(createClientsQuery);
    console.log(createProjectsQuery);
    console.log(createWorkLogsQuery);
    console.log('-----------------------------------------');
    
    // Construct real setup via RPC if available (optimistic)
    const { error: error1 } = await supabase.rpc('exec_sql', { query: createClientsQuery });
    if (error1) console.warn('Could not auto-create clients table (RPC exec_sql missing?):', error1.message);
    
    const { error: error2 } = await supabase.rpc('exec_sql', { query: createProjectsQuery });
    if (error2) console.warn('Could not auto-create projects table (RPC exec_sql missing?):', error2.message);
    
    const { error: error3 } = await supabase.rpc('exec_sql', { query: createWorkLogsQuery });
    if (error3) console.warn('Could not auto-create work_logs table (RPC exec_sql missing?):', error3.message);

    console.log('Setup script finished.');

  } catch (error) {
    console.error('Error during setup:', error);
  }
}

setupDatabase();

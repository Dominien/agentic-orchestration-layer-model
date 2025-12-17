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

async function seedDemoData() {
  console.log('Seeding Demo Data for Stark Industries...');

  try {
    // 1. Create Stark Industries Client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Stark Industries',
        industry: 'Defense',
        tax_region: 'US' // 0% tax
      })
      .select()
      .single();

    if (clientError) throw clientError;
    console.log('Created Client:', client);

    // 2. Create Project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        client_id: client.id,
        name: 'Arc Reactor Development',
        industry: 'Energy',
        hourly_rate: 500
      })
      .select()
      .single();

    if (projectError) throw projectError;
    console.log('Created Project:', project);

    // 3. Create Work Logs (Unbilled)
    const { data: logs, error: logsError } = await supabase
      .from('work_logs')
      .insert([
        { project_id: project.id, hours: 10, date: '2023-10-01' }, // Q4
        { project_id: project.id, hours: 5.5, date: '2023-10-02' }, // Q4
        { project_id: project.id, hours: 8, date: '2023-09-15' },   // Q3
        { project_id: project.id, hours: 4, date: '2023-08-20' }    // Q3
      ])
      .select();

    if (logsError) throw logsError;
    console.log(`Created ${logs.length} Work Logs.`);

    console.log('Demo Data Seeding Complete.');

  } catch (error) {
    console.error('Error seeding demo data:', error);
  }
}

seedDemoData();

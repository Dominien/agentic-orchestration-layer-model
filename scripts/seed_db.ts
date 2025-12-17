import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { faker } from '@faker-js/faker';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('Seeding database...');

  try {
    // 1. Create 50 Clients
    console.log('Generating 50 clients...');
    const clientsData = Array.from({ length: 50 }).map(() => ({
      name: faker.company.name(),
      industry: faker.commerce.department(),
      tax_region: faker.helpers.arrayElement(['EU_DE', 'US', 'UK', 'EU_FR', 'APAC']),
    }));

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .insert(clientsData)
      .select();

    if (clientsError) throw clientsError;
    if (!clients) throw new Error('No clients returned');

    console.log(`Created ${clients.length} clients.`);

    // 2. Create 100+ Projects
    console.log('Generating 100+ projects...');
    const projectsData = [];
    
    // Ensure each client has at least 1 project, plus random extras
    for (const client of clients) {
        const numProjects = faker.number.int({ min: 1, max: 4 });
        for (let i = 0; i < numProjects; i++) {
            projectsData.push({
                client_id: client.id,
                name: faker.commerce.productName() + ' Project',
                industry: client.industry, // Inherit from client for simplicity, or randomize
                hourly_rate: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
            });
        }
    }

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .insert(projectsData)
      .select();

    if (projectsError) throw projectsError;
    if (!projects) throw new Error('No projects returned');

    console.log(`Created ${projects.length} projects.`);

    // 3. Create 2000+ Work Logs
    console.log('Generating 2000+ work logs...');
    const workLogsData = [];
    
    // Distribute logs across projects
    // We want ~2000 logs total. 
    // projects.length is roughly 100-200.
    // 2000 / 100 = 20 logs per project on average.
    
    for (const project of projects) {
        const numLogs = faker.number.int({ min: 5, max: 30 });
        for (let i = 0; i < numLogs; i++) {
            workLogsData.push({
                project_id: project.id,
                hours: faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
                date: faker.date.past({ years: 1 }).toISOString().split('T')[0],
            });
        }
    }
    
    // Batch insert work logs to avoid request limits
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < workLogsData.length; i += batchSize) {
        const batch = workLogsData.slice(i, i + batchSize);
        const { error: logsError } = await supabase
            .from('work_logs')
            .insert(batch);
            
        if (logsError) throw logsError;
        insertedCount += batch.length;
        process.stdout.write(`\rInserted ${insertedCount}/${workLogsData.length} logs...`);
    }

    console.log('\nDatabase seeding completed successfully!');

  } catch (error) {
    console.error('Error during seeding:', error);
  }
}

seedDatabase();

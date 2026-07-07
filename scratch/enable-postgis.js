const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.otgoblqgiodpermgolua:TriageFlowOPD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log("Enabling postgis extension...");
  await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
  console.log("Postgis extension enabled successfully!");
  
  await client.end();
}

main().catch(console.error);

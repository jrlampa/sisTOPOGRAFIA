import 'dotenv/config';
import { getDbClient, initDbClient } from '../server/repositories/dbClient.js';

async function getTestUser() {
  await initDbClient();
  const sql = getDbClient();
  if (!sql) {
    console.error('DB client not available');
    return;
  }
  
  try {
    const rows = await sql`
      SELECT user_id, role 
      FROM user_roles 
      WHERE role = 'admin' 
        AND deleted_at IS NULL 
      LIMIT 1
    `;
    console.log(JSON.stringify(rows[0]));
    process.exit(0);
  } catch (err) {
    console.error('Error fetching user:', err.message);
    process.exit(1);
  }
}

getTestUser();

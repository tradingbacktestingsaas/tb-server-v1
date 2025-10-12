import dbConnection from '../src/config/db.js';

// Run the DB connection test
(async () => {
  try {
    await dbConnection();
    console.log('Connection test: SUCCESS');
    process.exit(0);
  } catch (err) {
    console.error('Connection test: FAILED');
    console.error(err);
    process.exit(1);
  }
})();
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = {
  query: async (text) => {
    const results = await pool.query(text);
    console.log(results.rows);
    return results.rows;
  },
};

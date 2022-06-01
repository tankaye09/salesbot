const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = {
  query: (text, params, callback) => {
    const results = pool.query(text, params, callback);
    console.log(results);
    return results;
  },
};

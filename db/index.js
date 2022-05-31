const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
module.exports = {
  query: (text, values) => {
    const client = pool.connect();
    client
      .query(text, values)
      .then((res) => {
        console.log(res.rows[0]);
        // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
        return res;
      })
      .catch((e) => console.error(e.stack));
  },
};

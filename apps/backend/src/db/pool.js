const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.MYSQL_HOST     || 'localhost',
  port:               parseInt(process.env.MYSQL_PORT || '3306'),
  user:               process.env.MYSQL_USER     || 'root',
  password:           process.env.MYSQL_PASSWORD || '',
  database:           process.env.MYSQL_DATABASE || 'qme_now',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+00:00',
});

module.exports = pool;

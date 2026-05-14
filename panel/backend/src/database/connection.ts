import mysql from 'mysql2/promise';
import { config } from '../config';

export const pool = mysql.createPool({
  host:               config.mysql.host,
  port:               config.mysql.port,
  user:               config.mysql.user,
  password:           config.mysql.password,
  database:           config.mysql.database,
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4',
});

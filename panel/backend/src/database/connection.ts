import mysql from 'mysql2/promise';
import { config } from '../config';

export const pool = mysql.createPool({
  host:               config.mysql.host,
  port:               config.mysql.port,
  user:               config.mysql.user,
  password:           config.mysql.password,
  database:           config.mysql.database,
  waitForConnections: true,
  // Bumped from 10 → 25. Many request paths (auth + slip + admin lists) take 2-3
  // connections simultaneously, and a single FOR UPDATE inside subscription create
  // can hold one for the full payment flow. 10 was easy to starve.
  connectionLimit:    25,
  charset:            'utf8mb4',
  // Fail fast if MySQL is unreachable instead of hanging the request thread.
  connectTimeout:     5000,
  // 2× the longest query we run (audit log scan ~30s in dev datasets).
  idleTimeout:        60_000,
});

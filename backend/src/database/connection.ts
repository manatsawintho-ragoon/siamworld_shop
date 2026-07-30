import mysql from 'mysql2/promise';
import { config } from '../config';

/**
 * Anything that can run a statement: the pool itself, or a connection checked
 * out for a transaction. Lets a helper be called both outside a transaction
 * (advisory read) and inside one (authoritative, under a row lock) without
 * duplicating it. Written as a Pick rather than `Pool | PoolConnection` because
 * a union of overloaded methods defeats TypeScript's overload resolution.
 */
export type Queryable = Pick<mysql.Pool, 'execute'>;

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  decimalNumbers: true,
});

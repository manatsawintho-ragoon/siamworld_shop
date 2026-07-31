import mysql from 'mysql2';

/**
 * Pins the parameter shape used by the traffic rollup upserts.
 *
 * This exists because the first deploy failed on it: the rows were wrapped one
 * level too deep, so `VALUES ?` expanded to `((a,b),(c,d))` and MySQL read the
 * whole batch as a single row ("Column count doesn't match value count").
 * tsc cannot catch it (both shapes are valid arrays) and it only surfaces once
 * real rows reach the database, so the contract is asserted here instead.
 */
const SQL = 'INSERT INTO t (a, b) VALUES ?';

describe('bulk upsert parameter shape', () => {
  const rows = [['x', 1], ['y', 2]];

  it('expands one array level into a row list', () => {
    expect(mysql.format(SQL, [rows])).toBe("INSERT INTO t (a, b) VALUES ('x', 1), ('y', 2)");
  });

  it('collapses to a single malformed row when wrapped twice', () => {
    // The bug, kept executable so the difference stays obvious.
    expect(mysql.format(SQL, [[rows]])).toBe("INSERT INTO t (a, b) VALUES (('x', 1), ('y', 2))");
  });
});

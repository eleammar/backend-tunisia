// util/helpers.js
/**
 * Bulk insert helper that builds a parametrized INSERT for many rows.
 * client: pg client (inside a transaction)
 * table: table name
 * columns: array of column names
 * rows: array of arrays (each inner array is values in same order as columns)
 */
function buildBulkInsert(table, columns, rows) {
  if (!rows.length) return { sql: '', params: [] };

  const cols = columns.map(c => `"${c}"`).join(', ');
  const params = [];
  const valueGroups = rows.map((r, i) => {
    const placeholders = r.map((v, j) => {
      params.push(v);
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const sql = `INSERT INTO ${table} (${cols}) VALUES ${valueGroups.join(', ')};`;
  return { sql, params };
}

module.exports = { buildBulkInsert };
const pool = require('../config/database');

// GET /api/audit-logs?userId=&action=&entityType=&from=&to=&page=&limit=
async function listAuditLogs(req, res) {
  try {
    const { userId, action, entityType, from, to, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const values = [];

    if (userId) { values.push(userId); conditions.push(`a.user_id = $${values.length}`); }
    if (action) { values.push(action); conditions.push(`a.action = $${values.length}`); }
    if (entityType) { values.push(entityType); conditions.push(`a.entity_type = $${values.length}`); }
    if (from) { values.push(from); conditions.push(`a.created_at >= $${values.length}`); }
    if (to) { values.push(to); conditions.push(`a.created_at <= $${values.length}`); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    values.push(Number(limit), offset);

    const result = await pool.query(
      `SELECT a.*, u.username
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs a ${whereClause}`,
      values.slice(0, values.length - 2)
    );

    res.json({
      success: true,
      logs: result.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    console.error('[ERROR] listAuditLogs:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
}

// GET /api/audit-logs/document/:id  (full lifecycle for one document)
// GET /api/audit-logs/document/:id
// Full lifecycle/audit trail for one document,
// including document-level AND version-level events.
async function documentAuditTrail(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         a.*,
         u.username,
         v.version_number
       FROM audit_logs a
       LEFT JOIN users u
         ON a.user_id = u.id
       LEFT JOIN document_versions v
         ON (
           a.entity_type = 'document_version'
           AND a.entity_id = v.id
         )
       WHERE
         (
           a.entity_type = 'document'
           AND a.entity_id = $1
         )
         OR
         (
           a.entity_type = 'document_version'
           AND v.document_id = $1
         )
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      logs: result.rows
    });

  } catch (err) {
    console.error(
      '[ERROR] documentAuditTrail:',
      err.message
    );

    res.status(500).json({
      success: false,
      message: 'Failed to fetch document audit trail'
    });
  }
}

module.exports = { listAuditLogs, documentAuditTrail };
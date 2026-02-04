import express from 'express';
import { pool } from '../db/index.js';

const router = express.Router();

const normalizeTemplate = (row) => {
  const metrics = row?.stats ?? row?.key_metrics ?? null;
  const derivedMetrics = metrics || {
    winRate: row?.key_metrics?.winRate ?? null,
    avgReturn: row?.key_metrics?.avgReturn ?? null,
    risk: row?.risk_level ?? null,
  };

  return {
    ...row,
    metrics: derivedMetrics,
  };
};

router.get('/templates', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM strategy_templates ORDER BY featured DESC, name ASC'
    );
    res.json(rows.map(normalizeTemplate));
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.get('/templates/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM strategy_templates WHERE id = $1',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(normalizeTemplate(rows[0]));
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_strategies WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user strategies:', error);
    res.status(500).json({ error: 'Failed to fetch user strategies' });
  }
});

router.post('/user', async (req, res) => {
  try {
    const {
      user_id,
      userId,
      name,
      description = null,
      category = null,
      config = {},
      is_active = true,
    } = req.body || {};

    const resolvedUserId = user_id || userId;

    if (!resolvedUserId || !name) {
      return res.status(400).json({ error: 'user_id and name are required' });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO user_strategies (
        user_id,
        name,
        description,
        category,
        config,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
      RETURNING *
      `,
      [resolvedUserId, name, description, category, JSON.stringify(config), is_active]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating user strategy:', error);
    res.status(500).json({ error: 'Failed to create user strategy' });
  }
});

router.put('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM user_strategies WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'User strategy not found' });
    }

    const existing = existingRows[0];
    const {
      name = existing.name,
      description = existing.description,
      category = existing.category,
      config = existing.config ?? {},
      is_active = existing.is_active,
    } = req.body || {};

    const { rows } = await pool.query(
      `
      UPDATE user_strategies
      SET name = $1,
          description = $2,
          category = $3,
          config = $4::jsonb,
          is_active = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [name, description, category, JSON.stringify(config), is_active, id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating user strategy:', error);
    res.status(500).json({ error: 'Failed to update user strategy' });
  }
});

router.delete('/user/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM user_strategies WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User strategy not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user strategy:', error);
    res.status(500).json({ error: 'Failed to delete user strategy' });
  }
});

export default router;

import { Router } from 'express';
import type { BacklogClient } from '../integrations/backlogClient.js';

export function createBacklogRouter(backlogClient: BacklogClient): Router {
  const router = Router();

  router.get('/items', async (req, res) => {
    const { items, backlogSync } = await backlogClient.fetchItems({
      status: req.query.status !== undefined ? String(req.query.status) : undefined,
      division: req.query.division !== undefined ? String(req.query.division) : undefined,
      sprintId: req.query.sprintId !== undefined ? String(req.query.sprintId) : undefined,
      priority: req.query.priority !== undefined ? String(req.query.priority) : undefined,
      type: req.query.type !== undefined ? String(req.query.type) : undefined,
      q: req.query.q !== undefined ? String(req.query.q) : undefined,
    });

    res.status(200).json({
      items,
      backlogSync,
    });
  });

  return router;
}

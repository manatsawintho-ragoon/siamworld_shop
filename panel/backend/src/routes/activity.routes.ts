import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { activityService } from '../services/activity.service';

const router = Router();

// Caps keep a buggy/malicious client from flooding the table. The tracker batches a
// handful of events per flush; 30 is generous headroom.
const eventSchema = z.object({
  type: z.enum(['page_view', 'feature_click']),
  value: z.string().min(1).max(255),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(30),
});

/**
 * Behavioural telemetry ingest. Called by the frontend tracker via navigator.sendBeacon
 * (cookie-authenticated, same-origin). Fire-and-forget: always 204, even on partial drops.
 */
router.post('/', requireAuth, asyncRoute(async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (parsed.success) {
    await activityService.recordEvents(req.user!.userId, req.ip, parsed.data.events);
  }
  res.status(204).end();
}));

export default router;

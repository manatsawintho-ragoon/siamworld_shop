import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAdmin } from '../middleware/auth';
import { showcaseService } from '../services/showcase.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ── Public: active showcase items for the landing page ───────────────────────
router.get('/', asyncRoute(async (_req, res) => {
  const items = await showcaseService.listActive();
  res.json({ items });
}));

// ── Admin CRUD ────────────────────────────────────────────────────────────────
router.get('/admin', requireAdmin, asyncRoute(async (_req, res) => {
  const items = await showcaseService.listAll();
  res.json({ items });
}));

router.post('/admin', requireAdmin, asyncRoute(async (req, res) => {
  const { title, description, imageData } = req.body || {};
  const id = await showcaseService.create({
    title: String(title || ''),
    description: String(description || ''),
    imageData: String(imageData || ''),
  });
  res.status(201).json({ success: true, id });
}));

router.post('/admin/reorder', requireAdmin, asyncRoute(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((n: any) => parseInt(n, 10)).filter(Boolean) : [];
  await showcaseService.reorder(ids);
  res.json({ success: true });
}));

router.put('/admin/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) throw new ValidationError('id ไม่ถูกต้อง');
  const { title, description, imageData } = req.body || {};
  const patch: Record<string, string> = {};
  if (title !== undefined) patch.title = String(title);
  if (description !== undefined) patch.description = String(description);
  if (imageData) patch.imageData = String(imageData);
  await showcaseService.update(id, patch);
  res.json({ success: true });
}));

router.patch('/admin/:id/active', requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) throw new ValidationError('id ไม่ถูกต้อง');
  await showcaseService.setActive(id, req.body?.active !== false);
  res.json({ success: true });
}));

router.delete('/admin/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) throw new ValidationError('id ไม่ถูกต้อง');
  await showcaseService.remove(id);
  res.json({ success: true });
}));

export default router;

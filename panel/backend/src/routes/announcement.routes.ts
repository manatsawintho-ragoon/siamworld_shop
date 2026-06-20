import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute';
import { announcementService } from '../services/announcement.service';

// Open read endpoint polled by every customer shop (via host.docker.internal:5000).
// Returns published announcements only — low-sensitivity broadcast content meant
// to be shown to all customers, so no per-shop auth (keeps existing shop envs
// untouched). Lock with a shared key later if needed.
const router = Router();

router.get('/active', asyncRoute(async (_req, res) => {
  const announcements = await announcementService.listActive();
  res.json({ success: true, announcements });
}));

export default router;

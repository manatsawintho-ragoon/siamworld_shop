import { Router } from 'express';
import { ticketService } from '../services/ticket.service';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Zod schemas for validation
// Caps prevent a malicious or buggy client from flooding the DB. 8k is more than enough
// for support context; users with longer reports can attach pastes/screenshots.
const TICKET_MESSAGE_MAX = 8000;

const createTicketSchema = z.object({
  subject: z.string().min(3).max(255),
  message: z.string().min(1).max(TICKET_MESSAGE_MAX),
});

const addMessageSchema = z.object({
  message: z.string().min(1).max(TICKET_MESSAGE_MAX),
});

// -- Customer Routes --
router.get('/', requireAuth, async (req, res) => {
  try {
    const tickets = await ticketService.getCustomerTickets(req.user!.userId);
    res.json(tickets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const data = createTicketSchema.parse(req.body);
    const ticketId = await ticketService.createTicket(req.user!.userId, data.subject, data.message);
    res.status(201).json({ id: ticketId });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const messages = await ticketService.getTicketMessages(parseInt(req.params.id), req.user!.userId, false);
    res.json(messages);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const data = addMessageSchema.parse(req.body);
    await ticketService.addMessage(parseInt(req.params.id), req.user!.userId, data.message, false);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/close', requireAuth, async (req, res) => {
  try {
    await ticketService.closeTicket(parseInt(req.params.id), req.user!.userId, false);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// -- Admin Routes --
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const tickets = await ticketService.getAllTickets();
    res.json(tickets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/:id/messages', requireAdmin, async (req, res) => {
  try {
    const messages = await ticketService.getTicketMessages(parseInt(req.params.id), undefined, true);
    res.json(messages);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/admin/:id/messages', requireAdmin, async (req, res) => {
  try {
    const data = addMessageSchema.parse(req.body);
    await ticketService.addMessage(parseInt(req.params.id), req.user!.userId, data.message, true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/admin/:id/close', requireAdmin, async (req, res) => {
  try {
    await ticketService.closeTicket(parseInt(req.params.id), undefined, true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
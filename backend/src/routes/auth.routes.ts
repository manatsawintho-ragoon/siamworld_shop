import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/schemas';

const router = Router();

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, user } = await authService.login(req.body.username, req.body.password);
    res.json({ success: true, message: 'Login successful', token, user });
  } catch (err) { next(err); }
});

router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, user } = await authService.register(req.body.username, req.body.password, req.body.email);
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ', token, user });
  } catch (err) { next(err); }
});

export default router;

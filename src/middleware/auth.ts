import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
  }

  // Accept our local mock token format "local-token-USR-001-..."
  if (token.startsWith('local-token-')) {
    req.user = { uid: token.split('-')[2] };
    return next();
  }

  // Reject otherwise since we aren't using Firebase anymore
  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};

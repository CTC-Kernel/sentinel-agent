import { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: string;
      sessionId: string;
    }

    interface Request {
      user?: User;
    }
  }
}

// import { Request } from 'express'; // Removed unused import

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

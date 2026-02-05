// Basic express types when @types/express is not installed
// For full types, install: npm install --save-dev @types/express

declare module 'express' {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 export type Request = any;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 export type Response = any;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 export type NextFunction = any;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 export type Express = any;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 export type RequestHandler = any;

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const express: any;
 export default express;
}

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

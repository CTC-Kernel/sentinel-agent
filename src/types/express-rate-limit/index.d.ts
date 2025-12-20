import { Request, Response, RequestHandler } from 'express';

declare namespace RateLimit {
  type ValueDeterminingMiddleware = (req: Request, res: Response) => number | Promise<number>;
  type RequestSkipper = (req: Request, res: Response) => boolean;

  interface RateLimitOptions {
    windowMs?: number;
    max?: number | ValueDeterminingMiddleware;
    message?: any;
    statusCode?: number;
    headers?: boolean;
    draftPolliRatelimitHeaders?: boolean;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    requestWasSuccessful?: (req: Request, res: Response) => boolean;
    skip?: RequestSkipper;
    keyGenerator?: (req: Request, res: Response) => string | Promise<string>;
    handler?: (req: Request, res: Response, next: (err?: any) => void, options: RateLimitOptions) => void;
    onLimitReached?: (req: Request, res: Response, options: RateLimitOptions) => void;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
  }

  interface RateLimitRequestHandler extends RequestHandler {}
}

declare function rateLimit(options?: RateLimit.RateLimitOptions): RateLimit.RateLimitRequestHandler;

export = rateLimit;
export as namespace rateLimit;

declare namespace rateLimit {
  export import RateLimitOptions = RateLimit.RateLimitOptions;
  export import RateLimitRequestHandler = RateLimit.RateLimitRequestHandler;
}

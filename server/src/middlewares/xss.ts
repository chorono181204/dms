import { NextFunction, Request, Response } from 'express';
import { inHTMLData } from 'xss-filters';

/**
 * Clean for xss.
 * @param {string/object} data - The value to sanitize
 * @return {string/object} The sanitized value
 */
export const clean = <T>(data: T | string = ''): T => {
  if (typeof data === 'string') {
    return inHTMLData(data).trim() as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((i) => clean(i)) as unknown as T;
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sanitization for 'content' field which stores HTML
      if (key === 'content') {
        sanitized[key] = value;
      } else {
        sanitized[key] = clean(value);
      }
    }
    return sanitized as T;
  }
  return data;
};

const middleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body) req.body = clean(req.body);
    if (req.query) req.query = clean(req.query);
    if (req.params) req.params = clean(req.params);
    next();
  };
};

export default middleware;

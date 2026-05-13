import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface LogCtx {
  fn: string;
  tag?: string;
  userId?: string;
  role?: string;
  action?: string;
  requestId?: string;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

interface RequestLogContext {
  requestId: string;
  method?: string;
  path?: string;
}

const requestContext = new AsyncLocalStorage<RequestLogContext>();

export const getRequestLogContext = (): RequestLogContext | undefined =>
  requestContext.getStore();

export const createRequestContextMiddleware = (service: string) =>
  (req: any, res: any, next: () => void): void => {
    const incoming = req.headers?.['x-request-id'];
    const requestId =
      (Array.isArray(incoming) ? incoming[0] : incoming) ||
      req.headers?.['x-correlation-id'] ||
      randomUUID();

    if (typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', requestId);
    }

    requestContext.run({
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    }, () => {
      emit(service, 'info', {
        fn: 'request',
        tag: `${service}_request_start`,
        action: 'REQUEST_START',
        requestId,
      }, `${req.method} ${req.originalUrl || req.url}`);
      next();
    });
  };

export const attachRequestIdToAxios = (axiosLike: any): void => {
  if (!axiosLike?.interceptors?.request?.use) return;

  axiosLike.interceptors.request.use((config: any) => {
    const activeRequest = getRequestLogContext();
    if (!activeRequest?.requestId) return config;

    config.headers = config.headers || {};
    config.headers['X-Request-Id'] = activeRequest.requestId;
    return config;
  });
};

function emit(
  service: string,
  level: Level,
  ctx: LogCtx,
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const activeRequest = getRequestLogContext();
  const entry: Record<string, unknown> = {
    ts:      new Date().toISOString(),
    eventId: randomUUID(),
    level,
    service,
    ...((ctx.requestId || activeRequest?.requestId) && { requestId: ctx.requestId || activeRequest?.requestId }),
    ...(activeRequest?.method && { method: activeRequest.method }),
    ...(activeRequest?.path && { path: activeRequest.path }),
    fn:      ctx.fn,
    ...(ctx.tag    && { tag:    ctx.tag    }),
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.role   && { role:   ctx.role   }),
    ...(ctx.action && { action: ctx.action }),
    msg,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

export interface ServiceLogger {
  /** Log function entry — call at the very top of every controller function */
  enter(ctx: LogCtx, data?: Record<string, unknown>): void;
  /** Log a meaningful business event */
  info(ctx: LogCtx, msg: string, data?: Record<string, unknown>): void;
  /** Log a DB query or result */
  db(ctx: LogCtx, operation: string, data?: Record<string, unknown>): void;
  /** Log a non-fatal warning */
  warn(ctx: LogCtx, msg: string, data?: Record<string, unknown>): void;
  /** Log an error */
  error(ctx: LogCtx, msg: string, err?: unknown): void;
}

export const createLogger = (service: string): ServiceLogger => ({
  enter: (ctx, data) =>
    emit(service, 'info', ctx, `→ ${ctx.fn}`, data),

  info: (ctx, msg, data) =>
    emit(service, 'info', ctx, msg, data),

  db: (ctx, operation, data) =>
    emit(service, 'debug', ctx, `DB:${operation}`, data),

  warn: (ctx, msg, data) =>
    emit(service, 'warn', ctx, msg, data),

  error: (ctx, msg, err) =>
    emit(service, 'error', ctx, msg, {
      error: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    }),
});

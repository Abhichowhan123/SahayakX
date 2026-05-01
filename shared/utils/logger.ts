export interface LogCtx {
  fn: string;
  tag?: string;
  userId?: string;
  role?: string;
  action?: string;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(
  service: string,
  level: Level,
  ctx: LogCtx,
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const entry: Record<string, unknown> = {
    ts:      new Date().toISOString(),
    level,
    service,
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

import { Platform } from 'react-native';

export interface AppLogCtx {
  fn: string;
  tag?: string;
  screen?: string;
  userId?: string;
  role?: string;
  action?: string;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, ctx: AppLogCtx, msg: string, extra?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    ts:      new Date().toISOString(),
    level,
    app:     'mobile',
    platform: Platform.OS,
    fn:      ctx.fn,
    ...(ctx.tag    && { tag:    ctx.tag    }),
    ...(ctx.screen && { screen: ctx.screen }),
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.role   && { role:   ctx.role   }),
    ...(ctx.action && { action: ctx.action }),
    msg,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

export const appLogger = {
  info:  (ctx: AppLogCtx, msg: string, data?: Record<string, unknown>) =>
    emit('info', ctx, msg, data),

  warn:  (ctx: AppLogCtx, msg: string, data?: Record<string, unknown>) =>
    emit('warn', ctx, msg, data),

  error: (ctx: AppLogCtx, msg: string, err?: unknown) =>
    emit('error', ctx, msg, {
      error: err instanceof Error ? err.message : String(err),
    }),

  /** Log an outgoing API request */
  apiReq: (method: string, url: string, ctx?: Partial<AppLogCtx>) =>
    emit('info', { fn: 'apiRequest', action: 'API_REQUEST', ...ctx }, `→ ${method} ${url}`),

  /** Log an API response */
  apiRes: (method: string, url: string, status: number, ctx?: Partial<AppLogCtx>) =>
    emit(status >= 400 ? 'warn' : 'info', { fn: 'apiResponse', action: 'API_RESPONSE', ...ctx }, `← ${method} ${url}`, { status }),

  /** Log an API error */
  apiErr: (method: string, url: string, status: number | undefined, err: unknown, ctx?: Partial<AppLogCtx>) =>
    emit('error', { fn: 'apiError', action: 'API_ERROR', ...ctx }, `✗ ${method} ${url}`, {
      status,
      error: err instanceof Error ? err.message : String(err),
    }),
};

import { Platform } from 'react-native';

export interface AdminLogCtx {
  fn: string;
  screen?: string;
  adminUser?: string;
  action?: string;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, ctx: AdminLogCtx, msg: string, extra?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    ts:        new Date().toISOString(),
    level,
    app:       'admin-panel',
    platform:  Platform.OS,
    fn:        ctx.fn,
    ...(ctx.screen    && { screen:    ctx.screen    }),
    ...(ctx.adminUser && { adminUser: ctx.adminUser }),
    ...(ctx.action    && { action:    ctx.action    }),
    msg,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

export const adminLogger = {
  info:  (ctx: AdminLogCtx, msg: string, data?: Record<string, unknown>) =>
    emit('info', ctx, msg, data),

  warn:  (ctx: AdminLogCtx, msg: string, data?: Record<string, unknown>) =>
    emit('warn', ctx, msg, data),

  error: (ctx: AdminLogCtx, msg: string, err?: unknown) =>
    emit('error', ctx, msg, {
      error: err instanceof Error ? err.message : String(err),
    }),

  /** Log an outgoing admin API request */
  apiReq: (method: string, url: string, ctx?: Partial<AdminLogCtx>) =>
    emit('info', { fn: 'apiRequest', action: 'API_REQUEST', ...ctx }, `→ ${method} ${url}`),

  /** Log an API response */
  apiRes: (method: string, url: string, status: number, ctx?: Partial<AdminLogCtx>) =>
    emit(status >= 400 ? 'warn' : 'info', { fn: 'apiResponse', action: 'API_RESPONSE', ...ctx }, `← ${method} ${url}`, { status }),

  /** Log an API error */
  apiErr: (method: string, url: string, status: number | undefined, err: unknown, ctx?: Partial<AdminLogCtx>) =>
    emit('error', { fn: 'apiError', action: 'API_ERROR', ...ctx }, `✗ ${method} ${url}`, {
      status,
      error: err instanceof Error ? err.message : String(err),
    }),
};

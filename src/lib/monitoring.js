import * as Sentry from '@sentry/react'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
const sentryEnabled = Boolean(sentryDsn)

function sanitizeEvent(event) {
  if (event.request?.headers) {
    delete event.request.headers.Authorization
    delete event.request.headers.authorization
    delete event.request.headers.Cookie
    delete event.request.headers.cookie
  }

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      const normalizedKey = key.toLowerCase()
      if (
        normalizedKey.includes('password') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('cookie')
      ) {
        delete event.extra[key]
      }
    }
  }

  return event
}

export function initMonitoring() {
  if (!sentryEnabled) return

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    beforeSend: sanitizeEvent,
  })
}

export function setMonitoringUser(userId) {
  if (!sentryEnabled || !userId) return
  Sentry.setUser({ id: userId })
}

export function clearMonitoringUser() {
  if (!sentryEnabled) return
  Sentry.setUser(null)
}

export function captureException(error, context = {}) {
  if (!sentryEnabled || !error) return
  Sentry.captureException(error, { extra: context })
}

export function captureSupabaseError(error, context = {}) {
  if (!error) return
  captureException(error, {
    ...context,
    source: 'supabase',
    code: error.code,
    status: error.status,
  })
}

export { Sentry }

import posthog from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'
const captureInDevelopment = import.meta.env.VITE_POSTHOG_CAPTURE_IN_DEVELOPMENT === 'true'
const analyticsEnabled = Boolean(posthogKey) && (import.meta.env.PROD || captureInDevelopment)

let initialized = false

function sanitizeProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      const normalizedKey = key.toLowerCase()
      if (
        normalizedKey.includes('password') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('cookie')
      ) {
        return false
      }
      return value !== undefined
    })
  )
}

export function initAnalytics() {
  if (!analyticsEnabled || initialized) return

  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  })
  initialized = true
}

export function track(eventName, properties = {}) {
  if (!initialized) return
  posthog.capture(eventName, sanitizeProperties(properties))
}

export function identifyUser(userId) {
  if (!initialized || !userId) return
  posthog.identify(userId)
}

export function resetAnalyticsUser() {
  if (!initialized) return
  posthog.reset()
}

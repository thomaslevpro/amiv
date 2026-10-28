export type WarningDeliveryResult =
  | { status: 'sent' }
  | { status: 'email_rejected'; httpStatus: number }
  | { status: 'email_error' }
  | { status: 'confirmation_failed' }
  | { status: 'confirmation_error' }

// A 2xx response is not enough to make the account deletion-eligible: the
// matching attempt also has to be confirmed in the database.
export async function deliverInactivityWarning(
  send: () => Promise<Response>,
  confirm: () => Promise<boolean>,
): Promise<WarningDeliveryResult> {
  let response: Response
  try {
    response = await send()
  } catch {
    return { status: 'email_error' }
  }

  if (!response.ok) return { status: 'email_rejected', httpStatus: response.status }

  try {
    if (await confirm()) return { status: 'sent' }
    return { status: 'confirmation_failed' }
  } catch {
    return { status: 'confirmation_error' }
  }
}

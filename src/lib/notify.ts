export function notifyHousehold(params: {
  householdId: string
  triggeredByMemberId?: string | null
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => {})
}

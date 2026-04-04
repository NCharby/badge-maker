import type { WorkflowStatus, CancellationPolicy } from '@/types/platform'
import { buildStatusOrder } from './modules'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolve a status reference (UUID or system name) to its display name. */
function resolveRef(ref: string, ws: WorkflowStatus[]): string {
  if (UUID_RE.test(ref)) return ws.find(s => s.id === ref)?.name ?? ref
  return ref
}

/**
 * Returns the refund percentage (0-100) applicable at the current event status.
 *
 * Logic:
 * - Checkpoints are positioned in the workflow by resolving their status_id
 * - The applicable checkpoint is the LAST one at or before the current status
 * - Default (no checkpoints or event before first checkpoint): 100%
 * - Events at or past "Event Locked" with no covering checkpoint: 0%
 */
export function getApplicableRefundPercentage(
  currentEventStatus: string,
  workflowStatuses: WorkflowStatus[],
  cancellationPolicy: CancellationPolicy | null,
): number {
  const order = buildStatusOrder(workflowStatuses)
  const currentIdx = order.indexOf(currentEventStatus)
  if (currentIdx < 0) return 0

  const checkpoints = cancellationPolicy?.checkpoints ?? []
  if (checkpoints.length === 0) {
    // Default: 100% until Event Locked, 0% at or after
    const lockedIdx = order.indexOf('Event Locked')
    return lockedIdx >= 0 && currentIdx >= lockedIdx ? 0 : 100
  }

  // Resolve each checkpoint to its position, sort by position
  const resolved = checkpoints
    .map(cp => ({
      idx: order.indexOf(resolveRef(cp.status_id, workflowStatuses)),
      pct: cp.refund_percentage,
    }))
    .filter(cp => cp.idx >= 0)
    .sort((a, b) => a.idx - b.idx)

  if (resolved.length === 0) return 100

  // Walk backward: find the last checkpoint at or before current status
  let applicable: number | null = null
  for (const cp of resolved) {
    if (cp.idx <= currentIdx) applicable = cp.pct
  }

  // If event is before the first checkpoint, default 100%
  return applicable ?? 100
}

/**
 * Returns true if a hardship cancellation request is currently available.
 */
export function isHardshipAvailable(
  currentEventStatus: string,
  workflowStatuses: WorkflowStatus[],
  cancellationPolicy: CancellationPolicy | null,
): boolean {
  const hardship = cancellationPolicy?.hardship
  if (!hardship?.enabled) return false

  const order = buildStatusOrder(workflowStatuses)
  const currentIdx = order.indexOf(currentEventStatus)
  if (currentIdx < 0) return false

  // "Available from" — default: the first status after Published (or Published itself)
  const fromName = hardship.available_from_status
    ? resolveRef(hardship.available_from_status, workflowStatuses)
    : order[0]
  const fromIdx = order.indexOf(fromName)

  // "Available until" — default: Registration
  const untilName = resolveRef(hardship.available_until_status ?? 'Registration', workflowStatuses)
  const untilIdx = order.indexOf(untilName)
  if (untilIdx < 0) return false

  return currentIdx >= (fromIdx >= 0 ? fromIdx : 0) && currentIdx <= untilIdx
}

/**
 * Calculates the refund amount in cents for ticket-only items.
 * Merchandise is excluded per spec.
 */
export function calculateTicketRefundCents(
  orderItems: { item_type: string; unit_price: number; quantity: number; amount_refunded: number }[],
  refundPercentage: number,
): number {
  const ticketItems = orderItems.filter(i => i.item_type === 'ticket')
  const ticketTotal = ticketItems.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
  const alreadyRefunded = ticketItems.reduce((s, i) => s + Number(i.amount_refunded), 0)
  const refundable = ticketTotal - alreadyRefunded
  if (refundable <= 0) return 0
  return Math.round(refundable * (refundPercentage / 100) * 100) // cents
}

import type { WorkflowStatus, ModuleConfig } from '@/types/platform'

const SYSTEM_BEFORE = ['Draft', 'Published']
const SYSTEM_AFTER  = ['Event Locked', 'Registration', 'Happening Now', 'Closed', 'Archived']

/**
 * Builds the complete ordered status name list for an event.
 * Order: Draft, Published, [custom sorted by .order], Event Locked, Registration, Happening Now, Closed, Archived
 */
export function buildStatusOrder(workflowStatuses: WorkflowStatus[]): string[] {
  const sorted = [...workflowStatuses].sort((a, b) => a.order - b.order)
  return [...SYSTEM_BEFORE, ...sorted.map(s => s.name), ...SYSTEM_AFTER]
}

/**
 * Resolves a status reference (UUID or system name) to its display name.
 * UUIDs (36-char, hyphenated hex) look up the matching WorkflowStatus; system names pass through.
 */
function resolveStatusRef(ref: string, workflowStatuses: WorkflowStatus[]): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    return workflowStatuses.find(s => s.id === ref)?.name ?? ref
  }
  return ref
}

export type ModuleOpenState = 'not_yet_open' | 'open' | 'closed'

/**
 * Determines whether a module is currently not_yet_open, open, or closed.
 *
 * - not_yet_open: module is hidden and inaccessible (event hasn't reached opens_at_status)
 * - open:         module is fully interactive
 * - closed:       module is visible read-only (at or past closes_at_status; null → closes at Event Locked)
 *
 * opens_at_status = null → opens at Published (index 1), i.e. always open for non-Draft events.
 * closes_at_status = null → closes at 'Event Locked'.
 */
export function getModuleOpenState(
  config: ModuleConfig,
  currentStatus: string,
  workflowStatuses: WorkflowStatus[],
): ModuleOpenState {
  if (!config.enabled) return 'not_yet_open'

  const order = buildStatusOrder(workflowStatuses)
  const currentIdx = order.indexOf(currentStatus)
  if (currentIdx === -1) return 'not_yet_open'

  // Check opens_at_status
  if (config.opens_at_status) {
    const opensName = resolveStatusRef(config.opens_at_status, workflowStatuses)
    const opensIdx  = order.indexOf(opensName)
    if (opensIdx !== -1 && currentIdx < opensIdx) return 'not_yet_open'
  }

  // Check closes_at_status (null = closes at Event Locked)
  const closesRef  = config.closes_at_status ?? 'Event Locked'
  const closesName = resolveStatusRef(closesRef, workflowStatuses)
  const closesIdx  = order.indexOf(closesName)
  if (closesIdx !== -1 && currentIdx >= closesIdx) return 'closed'

  return 'open'
}

/** Returns true only when the module is in the 'open' state (fully interactive). */
export function isModuleOpen(
  config: ModuleConfig,
  currentStatus: string,
  workflowStatuses: WorkflowStatus[],
): boolean {
  return getModuleOpenState(config, currentStatus, workflowStatuses) === 'open'
}

/**
 * Resolves opens_at_status to its human-readable display name.
 * Returns null if opens_at_status is not set.
 */
export function getOpensAtName(
  config: ModuleConfig,
  workflowStatuses: WorkflowStatus[],
): string | null {
  if (!config.opens_at_status) return null
  return resolveStatusRef(config.opens_at_status, workflowStatuses)
}

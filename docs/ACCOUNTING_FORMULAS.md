# Accounting Report — Calculated Fields Reference

All formulas trace to `src/lib/analytics/queries.ts`. Variables reference columns on the `orders`, `order_items`, `event_attendees`, `ticket_types`, `merchandise`, `volunteer_shifts`, and `user_volunteer_signups` tables.

---

## 1. Financial Summary (Event, Org, Platform)

**Source:** `getEventFinancialSummary()`, `getOrgFinancialSummary()`, `getPlatformFinancialSummary()`

### Input Sets (from `orders` table, scoped to event/org/platform)

```
COMPLETED  = orders WHERE status IN ('complete', 'partial_refund')
REFUNDED   = orders WHERE status = 'refunded'
CANCELLED  = orders WHERE status = 'cancelled'
ALL_ORDERS = all orders in scope (includes 'pending' as well)
```

### Formulas

| Field | Formula | Notes |
|-------|---------|-------|
| **Total Income** | `SUM(COMPLETED.subtotal) + SUM(REFUNDED.subtotal)` | Includes fully-refunded orders because money was collected before refund |
| **Total Refunds** | `SUM(ALL_ORDERS.amount_refunded)` | Across ALL order statuses — any order can have partial refunds |
| **Total Cancellations** | `SUM(CANCELLED.subtotal)` | Only orders with status = 'cancelled' |
| **Net Revenue** | `Total Income - Total Refunds` | Computed server-side, never in browser |
| **Order Count** | `COUNT(COMPLETED) + COUNT(REFUNDED)` | Orders that generated income (excludes pending and cancelled) |
| **Refund Count** | `COUNT(ALL_ORDERS WHERE amount_refunded > 0)` | Any order with any refund, regardless of status |
| **Cancelled Count** | `COUNT(CANCELLED)` | |

### Why `REFUNDED` orders are included in Total Income

An order with status `'refunded'` originally collected payment. Its `subtotal` represents income that was earned and then returned. Including it in Total Income and separately showing the refund in Total Refunds gives the accurate gross-to-net picture:

```
Net Revenue = (collected from complete + collected from refunded) - (all refund amounts)
```

If a $450 order is fully refunded: Total Income += $450, Total Refunds += $450, Net Revenue += $0.

---

## 2. Ticket Revenue (per ticket type)

**Source:** `getEventTicketRevenue()`

### Input Sets

```
TICKET_TYPES     = ticket_types WHERE event_id = ?
ORDER_ITEMS      = order_items WHERE item_type = 'ticket'
                   AND orders.event_id = ?
                   AND orders.status IN ('complete', 'partial_refund', 'refunded')
ATTENDEES        = event_attendees WHERE event_id = ? AND ticket_status = 'Complete'
```

### Per-Ticket-Type Formulas

| Field | Formula |
|-------|---------|
| **Issued Count** | `COUNT(ATTENDEES WHERE ticket_type_id = T.id)` |
| **Pct of Total** | `Issued Count / SUM(all Issued Counts)` |
| **Gross Revenue** | `SUM(ORDER_ITEMS.quantity * ORDER_ITEMS.unit_price) WHERE item_id = T.id` |
| **Refunded Amount** | `SUM(ORDER_ITEMS.amount_refunded) WHERE item_id = T.id` |
| **Net Revenue** | `Gross Revenue - Refunded Amount` |
| **Is Sold Out** | `T.available_count IS NOT NULL AND Issued Count >= T.available_count` |

### Table Total Row

| Field | Formula |
|-------|---------|
| **Total Issued** | `SUM(all ticket types' Issued Count)` |
| **Total Revenue** | `SUM(all ticket types' Net Revenue)` |

---

## 3. Merchandise Revenue (per product)

**Source:** `getEventMerchandiseRevenue()`

### Input Sets

```
MERCHANDISE   = merchandise WHERE event_id = ?
ORDER_ITEMS   = order_items WHERE item_type = 'merchandise'
               AND orders.event_id = ?
               AND orders.status IN ('complete', 'partial_refund', 'refunded')
```

### Per-Product Formulas

| Field | Formula |
|-------|---------|
| **Qty Sold** | `SUM(ORDER_ITEMS.quantity) WHERE item_id = M.id` |
| **Gross Revenue** | `SUM(ORDER_ITEMS.quantity * ORDER_ITEMS.unit_price) WHERE item_id = M.id` |
| **Refunded Amount** | `SUM(ORDER_ITEMS.amount_refunded) WHERE item_id = M.id` |
| **Net Revenue** | `Gross Revenue - Refunded Amount` |
| **Status** | `IF M.enabled = false THEN 'Ended' ELSE IF (M.available_count IS NOT NULL AND Qty Sold >= M.available_count) THEN 'Sold Out' ELSE 'Active'` |

---

## 4. Attendee Breakdown (by ticket type)

**Source:** `getEventAttendeeBreakdown()`

### Input Set

```
ATTENDEES = event_attendees WHERE event_id = ? AND ticket_status = 'Complete'
            JOIN ticket_types ON ticket_type_id
```

### Formulas

| Field | Formula |
|-------|---------|
| **Count** | `COUNT(ATTENDEES) GROUP BY ticket_types.name` |
| **Pct of Total** | `Count / COUNT(all ATTENDEES)` |
| **Is Room Lead** | `TRUE if ANY attendee in this group has is_room_lead = true` |

---

## 5. Ticket Capacity (per ticket type)

**Source:** `getEventTicketCapacity()`

### Input Sets

```
TICKET_TYPES = ticket_types WHERE event_id = ?
ATTENDEES    = event_attendees WHERE event_id = ? AND ticket_status = 'Complete'
```

### Per-Type Formulas

| Field | Formula |
|-------|---------|
| **Issued Count** | `COUNT(ATTENDEES WHERE ticket_type_id = T.id)` |
| **Remaining Count** | `IF T.available_count IS NOT NULL THEN T.available_count - Issued Count ELSE NULL` |
| **Fill Pct** | `IF T.available_count IS NOT NULL AND T.available_count > 0 THEN Issued Count / T.available_count ELSE NULL` |
| **Is Sold Out** | `Remaining Count IS NOT NULL AND Remaining Count <= 0` |

`NULL` remaining/fill means unlimited capacity (no cap set).

---

## 6. Volunteer Stats

**Source:** `getEventVolunteerStats()`

### Input Sets

```
SHIFTS    = volunteer_shifts WHERE event_id = ?
SIGNUPS   = user_volunteer_signups WHERE event_id = ?
CONFIRMED = SIGNUPS WHERE status = 'confirmed'
NO_SHOWS  = SIGNUPS WHERE status = 'no_show'
```

### Formulas

| Field | Formula |
|-------|---------|
| **Total Shifts** | `COUNT(SHIFTS)` |
| **Total Capacity** | `SUM(SHIFTS.capacity)` |
| **Confirmed Signups** | `COUNT(CONFIRMED)` |
| **Fill Rate** | `IF Total Capacity > 0 THEN Confirmed Signups / Total Capacity ELSE 0` |
| **No-Show Count** | `COUNT(NO_SHOWS)` |
| **Total Hours Pledged** | `ROUND(SUM(SHIFTS.duration_minutes for each CONFIRMED signup) / 60, 1)` |

Hours Pledged calculation detail:
```
For each confirmed signup:
  Look up the shift's duration_minutes
  Add to running total
Total Hours = ROUND(total_minutes / 60, 1 decimal place)
```

---

## 7. Application Stats

**Source:** `getEventApplicationStats()`

### Input Set

```
ATTENDEES = event_attendees WHERE event_id = ?
```

### Formulas

| Field | Formula |
|-------|---------|
| **Incomplete** | `COUNT(ATTENDEES WHERE application_status = 'Incomplete')` |
| **In Progress** | `COUNT(ATTENDEES WHERE application_status = 'In Progress')` |
| **Needs Review** | `COUNT(ATTENDEES WHERE application_status = 'Needs Review')` |
| **Completed** | `COUNT(ATTENDEES WHERE application_status = 'Completed')` |
| **Approved** | `COUNT(ATTENDEES WHERE application_status = 'Approved')` |
| **Declined** | `COUNT(ATTENDEES WHERE application_status = 'Declined')` |
| **Closed** | `COUNT(ATTENDEES WHERE application_status = 'Closed')` |
| **Submitted** | `Needs Review + Completed + Approved + Declined + Closed` |
| **Approval Rate** | `IF Submitted > 0 THEN Approved / Submitted ELSE 0` |

"Submitted" excludes Incomplete and In Progress because those applications have not been finalized by the user.

---

## 8. Refund Breakdown (by channel)

**Source:** `getEventRefundsByChannel()`

### Input Set

```
REFUNDED_ORDERS = orders WHERE event_id = ? AND amount_refunded > 0
```

### Formulas

| Field | Formula |
|-------|---------|
| **Channel** | `orders.refund_channel ?? 'standard'` (NULL treated as standard) |
| **Amount** | `SUM(REFUNDED_ORDERS.amount_refunded) GROUP BY channel` |
| **Count** | `COUNT(REFUNDED_ORDERS) GROUP BY channel` |

### Org/Platform Refund Rate

```
GROSS_INCOME = SUM(orders.subtotal) WHERE status IN ('complete', 'partial_refund', 'refunded')
REFUND_TOTAL = SUM(orders.amount_refunded) WHERE amount_refunded > 0
Refund Rate  = IF GROSS_INCOME > 0 THEN REFUND_TOTAL / GROSS_INCOME ELSE 0
```

---

## 9. Revenue Trend (daily)

**Source:** `getOrgRevenueTrend()`, `getPlatformRevenueTrend()`

### Input Set

```
ORDERS = orders WHERE status IN ('complete', 'partial_refund', 'refunded')
         AND completed_at >= (now - N days)
         ORDER BY completed_at
```

### Formula

```
For each order:
  day = completed_at truncated to YYYY-MM-DD
  daily_net = orders.subtotal - orders.amount_refunded

Revenue Trend Point = { date: day, revenue: SUM(daily_net) GROUP BY day }
```

Sorted by date ascending.

---

## 10. Registration Funnel

**Source:** `getOrgRegistrationFunnel()`, `getPlatformRegistrationFunnel()`

### Input Set

```
ATTENDEES = event_attendees (scoped to org's events or all events)
```

### Stage Definitions

| Stage | Count Formula |
|-------|---------------|
| **Applied** | `COUNT(ATTENDEES WHERE application_status NOT IN ('Incomplete', 'In Progress'))` |
| **Approved** | `COUNT(ATTENDEES WHERE application_status = 'Approved')` |
| **Ticketed** | `COUNT(ATTENDEES WHERE ticket_status = 'Complete')` |
| **Locked** | `COUNT(ATTENDEES WHERE lock_status = 'Locked')` |

### Percentage Formula

```
Pct = stage_count / Applied_count
```

All percentages are relative to the top of funnel (Applied = 100%), not relative to the prior stage.

---

## 11. Attendee Retention

**Source:** `getOrgAttendeeRetention()`

### Input Sets

```
EVENTS    = platform_events WHERE organization_id = ? ORDER BY start_date ASC
ATTENDEES = event_attendees WHERE event_id IN (EVENTS.ids) AND ticket_status = 'Complete'
```

### Per-Event Formula

```
For event E at index i:
  users_E = SET of user_ids attending E

  IF E is upcoming (start_date > now) OR E is the last event:
    returnedCount = NULL
    retentionPct  = NULL
  ELSE:
    later_events = EVENTS[i+1 .. end]
    later_users  = UNION of all user_id sets from later_events
    returned     = COUNT(users_E INTERSECT later_users)
    retentionPct = IF |users_E| > 0 THEN returned / |users_E| ELSE NULL
```

An attendee "returned" if they hold a completed ticket to ANY later event by the same organization.

### Organization Average (UI-computed)

```
calculable_events = retention rows WHERE retentionPct IS NOT NULL
total_attendees   = SUM(calculable_events.attendeeCount)
total_returned    = SUM(calculable_events.returnedCount)
avg_retention     = IF total_attendees > 0 THEN total_returned / total_attendees ELSE NULL
```

This is a weighted average (larger events contribute more), not a simple average of percentages.

---

## 12. Trend Arrows (KPI comparison)

**Source:** `computeTrend()` in `src/lib/analytics/types.ts`

### Input

```
current = metric value for the selected period (e.g. last 30 days)
prior   = metric value for the equivalent prior period (e.g. the 30 days before that)
```

### Prior Period Calculation

```
sinceDate    = now - N days       (start of current period)
sinceDate2x  = now - 2N days     (start of combined period)

currentFinancial  = getFinancialSummary(sinceDate)
combinedFinancial = getFinancialSummary(sinceDate2x)

priorFinancial = {
  totalIncome:       combinedFinancial.totalIncome       - currentFinancial.totalIncome,
  totalRefunds:      combinedFinancial.totalRefunds      - currentFinancial.totalRefunds,
  totalCancellations: combinedFinancial.totalCancellations - currentFinancial.totalCancellations,
  netRevenue:        combinedFinancial.netRevenue        - currentFinancial.netRevenue,
  orderCount:        combinedFinancial.orderCount        - currentFinancial.orderCount,
  refundCount:       combinedFinancial.refundCount       - currentFinancial.refundCount,
  cancelledCount:    combinedFinancial.cancelledCount    - currentFinancial.cancelledCount,
}
```

### Trend Formula

```
diff     = current - prior
trend    = IF diff > 0 THEN 'up' ELSE IF diff < 0 THEN 'down' ELSE 'flat'
trendPct = IF prior != 0 THEN |diff / prior| ELSE IF current > 0 THEN 1.0 ELSE 0
```

Display: `{arrow} {trendPct * 100}% vs prior {period_label}`

- Revenue up = green arrow (good)
- Refund rate up = red arrow (bad, via `invertColor` flag)

---

## 13. Avg Ticket Price (Org/Platform KPI)

**Source:** Computed in the server page, not a query function.

```
avgTicketPrice = IF financial.orderCount > 0
                 THEN financial.totalIncome / financial.orderCount
                 ELSE 0
```

This is the average order value (total income divided by number of income-generating orders), not the average list price. It includes all order sizes and excludes $0 orders only if they result in $0 income.

---

## 14. Org/Platform Refund Rate (KPI card)

```
refundRate = operational.refunds.refundRate

Where:
  grossIncome   = SUM(orders.subtotal) WHERE status IN ('complete','partial_refund','refunded')
  refundTotal   = SUM(orders.amount_refunded) WHERE amount_refunded > 0
  refundRate    = IF grossIncome > 0 THEN refundTotal / grossIncome ELSE 0
```

This is a dollar-based rate (refund dollars / gross dollars), not a count-based rate.

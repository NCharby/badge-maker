-- ============================================================
-- Locks
-- Soft locks to prevent race conditions during checkout.
-- Covers tickets, volunteer shifts, rooms, and merchandise.
-- Lock duration: 15 minutes from creation.
--
-- IMPORTANT: Locks are ALWAYS stored in this table.
-- Never use in-process memory (Map, setInterval, etc.) for
-- soft locks — Hostinger runs a single-process model with no
-- shared memory between requests.
--
-- Workflow:
--   1. Acquire lock at start of checkout (INSERT with expires_at = now() + 15min)
--   2. Before inserting, check for and clear any expired locks on the resource
--   3. Release lock on purchase completion, abandonment, or expiry
-- ============================================================

CREATE TABLE public.locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL
    CHECK (resource_type IN ('ticket', 'shift', 'room', 'merchandise')),
  resource_id UUID NOT NULL,
  locked_by UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,   -- now() + interval '15 minutes' at insert time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Lookup by resource (most common query: "is this resource locked?")
CREATE INDEX idx_locks_resource ON public.locks(resource_type, resource_id, expires_at);

-- Lookup by user (for releasing all locks held by a user on checkout complete/abandon)
CREATE INDEX idx_locks_locked_by ON public.locks(locked_by);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.locks ENABLE ROW LEVEL SECURITY;

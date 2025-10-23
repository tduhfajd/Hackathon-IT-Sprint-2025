-- Add new status values to appeal_status enum
-- Note: IF NOT EXISTS requires PostgreSQL 9.1+, but not all versions support it for ALTER TYPE
-- So we use simple ADD VALUE which will error if already exists (safe for re-runs)

-- Add 'in_progress' status (equivalent to 'processing')
ALTER TYPE appeal_status ADD VALUE 'in_progress';

-- Add 'resolved' status (equivalent to 'completed')
ALTER TYPE appeal_status ADD VALUE 'resolved';

-- Note: 'processing' and 'completed' remain for backward compatibility
-- Frontend can use either: 'processing' or 'in_progress', 'completed' or 'resolved'


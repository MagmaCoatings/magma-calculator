-- Activity Log table for audit trail
-- Run this in Supabase SQL Editor

-- Drop existing if needed (uncomment if recreating)
-- DROP TABLE IF EXISTS activity_log;

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- RLS policies
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity logs (spoofing prevention)
CREATE POLICY "Users can insert own activity logs"
  ON activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT ON activity_log TO authenticated;

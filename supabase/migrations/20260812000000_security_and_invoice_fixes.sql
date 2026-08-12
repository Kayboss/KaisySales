-- Security fixes that were committed but never applied to the live DB
-- (originally from commit 4a5cdf9 + services invoice schema)

-- Remove anon DELETE on keep_alive
DROP POLICY IF EXISTS "Allow anon to delete old keep_alive records" ON keep_alive;

-- error_logs: only allow users to insert logs for themselves (was: any authenticated user)
DROP POLICY IF EXISTS "Anyone can insert error logs" ON error_logs;
DROP POLICY IF EXISTS "Users can insert own error logs" ON error_logs;
CREATE POLICY "Users can insert own error logs" ON error_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- invoices.notes column (services invoice save bug fix)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- customers.company display column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';

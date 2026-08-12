-- H1: Enforce subscription limits and expiry server-side via RLS.
-- Previously limits/expiry were checked only in client code, so direct API
-- calls could bypass plan limits and expired trials.

-- 1. Subscription validity (plan set, status active/confirmed, not expired)
CREATE OR REPLACE FUNCTION public.is_subscription_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.subscription_plan IS NOT NULL
      AND p.subscription_plan <> 'none'
      AND p.subscription_status IN ('active', 'confirmed')
      AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
  );
$$;

-- 2. Record creation limit check (called from INSERT policy WITH CHECK)
CREATE OR REPLACE FUNCTION public.can_create_record(rec_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN NOT public.is_subscription_active() THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.subscription_plan = 'gold'
      ) THEN true
      WHEN rec_type = 'sales' THEN
        (SELECT count(*) FROM public.sales s
         WHERE s.user_id = auth.uid()
           AND s.date >= date_trunc('month', now())::date
           AND s.date < (date_trunc('month', now()) + interval '1 month')::date)
        < (SELECT CASE (SELECT p.subscription_plan FROM public.profiles p WHERE p.id = auth.uid())
            WHEN 'silver' THEN 100 ELSE 10 END)
      WHEN rec_type = 'invoices' THEN
        (SELECT count(*) FROM public.invoices i
         WHERE i.user_id = auth.uid()
           AND i.date >= date_trunc('month', now())::date
           AND i.date < (date_trunc('month', now()) + interval '1 month')::date)
        < (SELECT CASE (SELECT p.subscription_plan FROM public.profiles p WHERE p.id = auth.uid())
            WHEN 'silver' THEN 20 ELSE 2 END)
      WHEN rec_type = 'products' THEN
        (SELECT count(*) FROM public.inventory i WHERE i.user_id = auth.uid())
        < (SELECT CASE (SELECT p.subscription_plan FROM public.profiles p WHERE p.id = auth.uid())
            WHEN 'silver' THEN 50 ELSE 5 END)
      ELSE true
    END;
$$;

-- 3. Split sales policy; block inserts beyond plan limits
DROP POLICY IF EXISTS "Users can CRUD their sales" ON sales;
CREATE POLICY "Users can read their sales" ON sales
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their sales" ON sales
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.can_create_record('sales'));
CREATE POLICY "Users can update their sales" ON sales
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their sales" ON sales
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Split invoices policy
DROP POLICY IF EXISTS "Users can CRUD their invoices" ON invoices;
CREATE POLICY "Users can read their invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their invoices" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.can_create_record('invoices'));
CREATE POLICY "Users can update their invoices" ON invoices
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their invoices" ON invoices
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Split inventory policy (products use lifetime count, not monthly)
DROP POLICY IF EXISTS "Users can CRUD their inventory" ON inventory;
CREATE POLICY "Users can read their inventory" ON inventory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their inventory" ON inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.can_create_record('products'));
CREATE POLICY "Users can update their inventory" ON inventory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their inventory" ON inventory
  FOR DELETE USING (auth.uid() = user_id);

-- Free for everyone: remove the leftover free-trial clock.
--
-- The subscription model is already disabled at both layers: the database
-- function can_create_record() returns true unconditionally (20260812040000)
-- and the client helpers isSubscriptionExpired / checkCreateLimit are hard-coded
-- to allow (src/utils/subscriptionLimits.js). What remains is a phantom clock:
-- handle_new_user still stamped a 3-day expiry on every signup, and the client
-- ensureFreeTrial path wrote the same, so accounts carried a "trial expired"
-- date that nothing checks. This normalises them so no account is ever in an
-- expired-looking state, and removes the clock for future signups.
--
-- No behaviour depends on these columns being an expiry, so this only clears
-- stale trial data (and the latent risk of re-blocking if enforcement is ever
-- switched back on). Paid plans (silver/gold) are left untouched.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_plan, subscription_status, subscription_expires_at)
  VALUES (NEW.id, NEW.email, 'free', 'active', NULL);
  RETURN NEW;
END;
$function$;

-- Accounts still on the placeholder plan become active free accounts with no clock.
UPDATE public.profiles
   SET subscription_plan = 'free',
       subscription_expires_at = NULL,
       subscription_status = CASE
         WHEN subscription_status IS NULL OR subscription_status = 'none' THEN 'active'
         ELSE subscription_status
       END
 WHERE subscription_plan IS NULL
    OR subscription_plan = 'none';

-- Clear the phantom trial expiry every existing free account carries.
UPDATE public.profiles
   SET subscription_expires_at = NULL
 WHERE subscription_plan = 'free'
   AND subscription_expires_at IS NOT NULL;

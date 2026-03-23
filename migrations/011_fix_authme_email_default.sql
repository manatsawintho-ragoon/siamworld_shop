-- Fix authme.email column: change DEFAULT 'your@email.com' to NULL
-- This prevents new registrations from getting the wrong default email
ALTER TABLE authme
  ALTER COLUMN email SET DEFAULT NULL;

-- Fix existing records that got the wrong default email
-- Only update rows where email matches the bad default AND were registered via web
-- (Safe: authme.email is just informational for the AuthMe plugin)
UPDATE authme
  SET email = NULL
  WHERE email = 'your@email.com';

-- ===============================================
-- SECURE PASSWORD MIGRATION SCRIPT
-- ===============================================
-- Run this ONCE after deploying the new auth system
-- This migrates plain-text passwords to bcrypt hashes

-- ⚠️  WARNING: This is a ONE-TIME migration
-- ⚠️  Ensure you have backups before running
-- ⚠️  After migration, switch to backend hashing only

-- Enable pgcrypto extension (bcrypt support in Postgres)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===============================================
-- SECURE MIGRATION FUNCTION
-- ===============================================
CREATE OR REPLACE FUNCTION migrate_plaintext_passwords()
RETURNS TABLE(
    migrated_count INTEGER,
    skipped_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_migrated INTEGER := 0;
    total_skipped INTEGER := 0;
    u RECORD;
BEGIN
    -- Loop through users with plain-text passwords
    -- Check for bcrypt pattern: $2a$ or $2b$ or $2y$
    FOR u IN
        SELECT id, password
        FROM users
        WHERE password IS NOT NULL
          AND password NOT LIKE '$2%'
          AND length(trim(password)) > 0
    LOOP
        -- Hash with bcrypt cost factor 12 (recommended for 2025)
        UPDATE users
        SET password = crypt(u.password, gen_salt('bf', 12)),
            updated_at = now()
        WHERE id = u.id;

        total_migrated := total_migrated + 1;
        RAISE NOTICE 'Migrated password for user ID: %', u.id;
    END LOOP;

    -- Count already hashed passwords (for reporting)
    SELECT COUNT(*) INTO total_skipped
    FROM users
    WHERE password LIKE '$2%';

    -- Log completion
    RAISE NOTICE 'Migration completed. Migrated: %, Skipped (already hashed): %',
                 total_migrated, total_skipped;

    RETURN QUERY SELECT total_migrated, total_skipped;
END;
$$;

-- ===============================================
-- VERIFICATION FUNCTION
-- ===============================================
CREATE OR REPLACE FUNCTION verify_password_migration()
RETURNS TABLE(
    total_users INTEGER,
    hashed_users INTEGER,
    plain_users INTEGER,
    migration_status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    total_count INTEGER;
    hashed_count INTEGER;
    plain_count INTEGER;
    status_msg TEXT;
BEGIN
    -- Count total users with passwords
    SELECT COUNT(*) INTO total_count
    FROM users
    WHERE password IS NOT NULL;

    -- Count bcrypt hashed passwords
    SELECT COUNT(*) INTO hashed_count
    FROM users
    WHERE password LIKE '$2%';

    -- Count plain text passwords
    plain_count := total_count - hashed_count;

    -- Determine status
    IF plain_count = 0 THEN
        status_msg := 'COMPLETE: All passwords migrated to bcrypt';
    ELSIF plain_count > 0 AND hashed_count > 0 THEN
        status_msg := 'PARTIAL: Migration in progress';
    ELSE
        status_msg := 'NOT_STARTED: All passwords are plain text';
    END IF;

    RETURN QUERY SELECT total_count, hashed_count, plain_count, status_msg;
END;
$$;

-- ===============================================
-- EXECUTION INSTRUCTIONS
-- ===============================================

-- 1. RUN MIGRATION (uncomment and execute):
-- SELECT * FROM migrate_plaintext_passwords();

-- 2. VERIFY RESULTS (run after migration):
-- SELECT * FROM verify_password_migration();

-- 3. CLEANUP (run after successful migration):
-- DROP FUNCTION migrate_plaintext_passwords();
-- DROP FUNCTION verify_password_migration();

-- ===============================================
-- IMPORTANT NOTES FOR PRODUCTION
-- ===============================================

/*
🔐 POST-MIGRATION SECURITY:

1. ✅ Switch to backend password hashing immediately
   - Use bcrypt npm package in Node.js/Deno
   - NEVER hash passwords in database after this

2. ✅ Audit and cleanup:
   - Delete any backups containing plain passwords
   - Check server logs for password exposure
   - Verify no triggers export passwords

3. ✅ Update application code:
   - Remove any database password hashing
   - Use server-side bcrypt for new registrations
   - Update login verification to use server-side compare

4. ✅ Monitoring:
   - Monitor for brute-force attempts
   - Implement rate limiting on auth endpoints
   - Log suspicious login patterns

🚨 CRITICAL:
- This migration uses Postgres pgcrypto (acceptable for migration)
- Production password hashing/verification MUST happen in backend code
- Database should only store bcrypt hashes, never process auth logic
*/

-- ===============================================
-- END OF MIGRATION SCRIPT
-- ===============================================

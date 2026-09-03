-- SecureDocChain password recovery
-- Run this on existing databases that pre-date the security-question columns.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS security_question VARCHAR(255),
  ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_security_question_consistency;

ALTER TABLE users
  ADD CONSTRAINT users_security_question_consistency
  CHECK (
    (security_question IS NULL AND security_answer_hash IS NULL)
    OR
    (security_question IS NOT NULL AND security_answer_hash IS NOT NULL)
  );

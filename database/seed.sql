-- ============================================
-- SecureDocChain Seed Data
-- ============================================

-- PHASE 6: Default roles
-- ON CONFLICT DO NOTHING makes this safe to re-run without duplicating rows
INSERT INTO roles (name) VALUES
    ('admin'),
    ('engineer'),
    ('reviewer'),
    ('auditor'),
    ('viewer')
ON CONFLICT (name) DO NOTHING;
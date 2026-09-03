-- ============================================
-- SecureDocChain Database Schema
-- ============================================
--
-- Complete database structure for:
--
-- - Authentication
-- - Role Based Access Control
-- - Document Management
-- - Document Version Control
-- - Check-out / Locking
-- - Document Sharing
-- - Reviews / Approval
-- - Publishing
-- - Blockchain Registration
-- - Audit Logging
-- - Security Question
--
-- Run this file top-to-bottom on a fresh database.
-- ============================================


-- ============================================
-- PHASE 6: ROLES AND USERS
-- ============================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,

    name VARCHAR(50)
        UNIQUE NOT NULL
);


CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    full_name VARCHAR(150)
        NOT NULL,

    username VARCHAR(50)
        UNIQUE NOT NULL,

    email VARCHAR(150)
        UNIQUE NOT NULL,

    password_hash TEXT
        NOT NULL,

    -- ========================================================
    -- SECURITY QUESTION
    --
    -- The question itself is stored so it can be displayed
    -- when the user changes their password.
    --
    -- The answer is NEVER stored as plain text.
    -- Only the bcrypt hash of the answer is stored.
    -- ========================================================

    security_question VARCHAR(255),

    security_answer_hash TEXT,

    -- ========================================================
    -- ROLE
    -- ========================================================

    role_id INTEGER
        NOT NULL
        REFERENCES roles(id),

    -- ========================================================
    -- ACCOUNT STATUS
    -- ========================================================

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    -- ========================================================
    -- Security question consistency
    --
    -- Either both question and answer hash exist,
    -- or neither exists.
    -- ========================================================

    CONSTRAINT users_security_question_consistency
    CHECK (
        (
            security_question IS NULL
            AND security_answer_hash IS NULL
        )
        OR
        (
            security_question IS NOT NULL
            AND security_answer_hash IS NOT NULL
        )
    )
);


CREATE INDEX idx_users_role_id
ON users(role_id);


CREATE INDEX idx_users_is_active
ON users(is_active);


-- ============================================
-- PHASE 8: DOCUMENTS
-- ============================================

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,

    title VARCHAR(200)
        NOT NULL,

    description TEXT,

    file_name VARCHAR(255)
        NOT NULL,

    file_path VARCHAR(500)
        NOT NULL,

    file_size INTEGER
        NOT NULL,

    mime_type VARCHAR(100)
        NOT NULL,

    uploaded_by INTEGER
        NOT NULL
        REFERENCES users(id),

    -- ========================================================
    -- DOCUMENT VERSION CONTROL
    -- ========================================================

    latest_version_id INTEGER,

    published_version_id INTEGER,

    -- ========================================================
    -- CHECK-OUT / DOCUMENT LOCKING
    -- ========================================================

    checked_out_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    checked_out_at TIMESTAMPTZ,

    -- ========================================================
    -- TIMESTAMPS
    -- ========================================================

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);


CREATE INDEX idx_documents_uploaded_by
ON documents(uploaded_by);


-- ============================================
-- PHASE 9+: DOCUMENT STATUS
-- ============================================

ALTER TABLE documents
ADD COLUMN status VARCHAR(20)
NOT NULL
DEFAULT 'draft';


-- status:
--
-- draft
-- pending_review
-- approved
-- rejected


ALTER TABLE documents
ADD COLUMN category VARCHAR(100);


ALTER TABLE documents
ADD COLUMN is_deleted BOOLEAN
NOT NULL
DEFAULT FALSE;


CREATE INDEX idx_documents_status
ON documents(status);


CREATE INDEX idx_documents_title
ON documents(title);


CREATE INDEX idx_documents_is_deleted
ON documents(is_deleted);


-- ============================================
-- DOCUMENT VERSIONS
-- ============================================

CREATE TABLE document_versions (
    id SERIAL PRIMARY KEY,

    document_id INTEGER
        NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    version_number INTEGER
        NOT NULL,

    file_name VARCHAR(255)
        NOT NULL,

    file_path VARCHAR(500)
        NOT NULL,

    file_size INTEGER
        NOT NULL,

    mime_type VARCHAR(100)
        NOT NULL,

    -- ========================================================
    -- INTEGRITY HASH
    -- ========================================================

    sha256_hash CHAR(64)
        NOT NULL,

    change_summary TEXT,

    -- ========================================================
    -- CURRENT WORKING VERSION
    --
    -- Only one version per document can have:
    --
    -- is_current = TRUE
    -- ========================================================

    is_current BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    -- ========================================================
    -- VERSION LIFECYCLE
    -- ========================================================

    version_status VARCHAR(20)
        NOT NULL
        DEFAULT 'draft'

        CHECK (
            version_status IN (
                'draft',
                'in_review',
                'approved',
                'published',
                'rejected',
                'superseded',
                'archived'
            )
        ),

    uploaded_by INTEGER
        NOT NULL
        REFERENCES users(id),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    -- ========================================================
    -- VERSION NUMBER MUST BE UNIQUE PER DOCUMENT
    -- ========================================================

    UNIQUE (
        document_id,
        version_number
    )
);


CREATE INDEX idx_versions_document_id
ON document_versions(document_id);


-- ============================================================
-- Only one current working version per document.
-- ============================================================

CREATE UNIQUE INDEX idx_one_current_version_per_document
ON document_versions(document_id)
WHERE is_current = TRUE;


-- ============================================================
-- Fast filtering by version lifecycle status.
-- ============================================================

CREATE INDEX idx_versions_status
ON document_versions(version_status);


-- ============================================================
-- Fast lookup of uploaded versions.
-- ============================================================

CREATE INDEX idx_versions_uploaded_by
ON document_versions(uploaded_by);


-- ============================================
-- DOCUMENT VERSION FOREIGN KEYS
-- ============================================

ALTER TABLE documents
ADD CONSTRAINT fk_documents_latest_version
FOREIGN KEY (latest_version_id)
REFERENCES document_versions(id)
ON DELETE SET NULL;


ALTER TABLE documents
ADD CONSTRAINT fk_documents_published_version
FOREIGN KEY (published_version_id)
REFERENCES document_versions(id)
ON DELETE SET NULL;


-- ============================================
-- BLOCKCHAIN TRANSACTIONS
-- ============================================

CREATE TABLE blockchain_transactions (
    id SERIAL PRIMARY KEY,

    document_id INTEGER
        NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    version_id INTEGER
        NOT NULL
        REFERENCES document_versions(id)
        ON DELETE CASCADE,

    block_index INTEGER
        NOT NULL,

    data_hash CHAR(64)
        NOT NULL,

    prev_block_hash CHAR(64)
        NOT NULL,

    block_hash CHAR(64)
        NOT NULL,

    nonce INTEGER
        NOT NULL
        DEFAULT 0,

    timestamp_ms BIGINT
        NOT NULL,

    tx_id VARCHAR(80)
        UNIQUE NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'confirmed',

    registered_by INTEGER
        NOT NULL
        REFERENCES users(id),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);


CREATE INDEX idx_blockchain_document_id
ON blockchain_transactions(document_id);


CREATE INDEX idx_blockchain_version_id
ON blockchain_transactions(version_id);


-- ============================================
-- DOCUMENT SHARING
-- ============================================

CREATE TABLE document_shares (
    id SERIAL PRIMARY KEY,

    document_id INTEGER
        NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    shared_by INTEGER
        NOT NULL
        REFERENCES users(id),

    shared_with INTEGER
        NOT NULL
        REFERENCES users(id),

    -- ========================================================
    -- PERMISSIONS
    -- ========================================================

    can_view BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    can_download BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    -- ========================================================
    -- EXPIRATION
    -- ========================================================

    expires_at TIMESTAMPTZ,

    -- ========================================================
    -- REVOCATION
    -- ========================================================

    revoked BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    -- ========================================================
    -- Download requires view permission.
    -- ========================================================

    CONSTRAINT share_download_requires_view
    CHECK (
        can_download = FALSE
        OR can_view = TRUE
    )
);


CREATE INDEX idx_shares_document_id
ON document_shares(document_id);


CREATE INDEX idx_shares_shared_with
ON document_shares(shared_with);


CREATE INDEX idx_shares_revoked
ON document_shares(revoked);


-- ============================================
-- REVIEWS
-- ============================================

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,

    document_id INTEGER
        NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    version_id INTEGER
        NOT NULL
        REFERENCES document_versions(id)
        ON DELETE CASCADE,

    reviewer_id INTEGER
        NOT NULL
        REFERENCES users(id),

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending'

        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected'
            )
        ),

    comments TEXT,

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);


CREATE INDEX idx_reviews_document_id
ON reviews(document_id);


CREATE INDEX idx_reviews_version_id
ON reviews(version_id);


CREATE INDEX idx_reviews_status
ON reviews(status);


CREATE INDEX idx_reviews_reviewer_id
ON reviews(reviewer_id);


-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id),

    action VARCHAR(50)
        NOT NULL,

    entity_type VARCHAR(50),

    entity_id INTEGER,

    details JSONB,

    ip_address VARCHAR(64),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
);


CREATE INDEX idx_audit_logs_user_id
ON audit_logs(user_id);


CREATE INDEX idx_audit_logs_action
ON audit_logs(action);


CREATE INDEX idx_audit_logs_entity
ON audit_logs(
    entity_type,
    entity_id
);


CREATE INDEX idx_audit_logs_created_at
ON audit_logs(created_at);
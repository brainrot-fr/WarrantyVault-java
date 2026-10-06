-- Pre-flight checks before applying constraints:
-- SELECT COUNT(*) FROM products WHERE warranty_months < 1 OR warranty_months > 120;
-- SELECT COUNT(*) FROM products WHERE purchase_price < 0;
-- SELECT COUNT(*) FROM products WHERE expires_on < purchased_on;
-- SELECT COUNT(*) FROM space_members WHERE role NOT IN ('OWNER','EDITOR','VIEWER');
-- SELECT COUNT(*) FROM space_invitations WHERE role NOT IN ('EDITOR','VIEWER')
--   OR status NOT IN ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED');
ALTER TABLE products ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE spaces ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE space_invitations ADD COLUMN token_hash CHAR(64) NULL;
-- Pending invitations created before invite codes cannot prove a trusted invitation channel.
UPDATE space_invitations SET status = 'EXPIRED' WHERE status = 'PENDING';
ALTER TABLE products ADD CONSTRAINT ck_products_warranty_months CHECK (warranty_months BETWEEN 1 AND 120);
ALTER TABLE products ADD CONSTRAINT ck_products_price CHECK (purchase_price >= 0);
ALTER TABLE products ADD CONSTRAINT ck_products_dates CHECK (expires_on >= purchased_on);
ALTER TABLE space_members ADD CONSTRAINT ck_space_members_role CHECK (role IN ('OWNER','EDITOR','VIEWER'));
ALTER TABLE space_invitations ADD CONSTRAINT ck_space_invitations_role CHECK (role IN ('EDITOR','VIEWER'));
ALTER TABLE space_invitations ADD CONSTRAINT ck_space_invitations_status CHECK (status IN ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED'));
CREATE INDEX idx_space_invitations_space_email_status ON space_invitations(space_id, invited_email, status);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

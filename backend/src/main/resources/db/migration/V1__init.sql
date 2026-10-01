CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_login_at TIMESTAMP NULL
);

CREATE TABLE refresh_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  family_id CHAR(36) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  replaced_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL,
  user_agent VARCHAR(255) NULL,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE spaces (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_spaces_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_spaces_owner_name UNIQUE (owner_id, name)
);

CREATE TABLE space_members (
  space_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(10) NOT NULL,
  added_at TIMESTAMP NOT NULL,
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT fk_space_members_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_space_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_space_members_user ON space_members(user_id);

CREATE TABLE space_invitations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  space_id CHAR(36) NOT NULL,
  invited_email VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL,
  invited_by CHAR(36) NOT NULL,
  status VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  responded_at TIMESTAMP NULL,
  CONSTRAINT fk_space_invitations_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_space_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_space_invitations_email_status ON space_invitations(invited_email, status);
CREATE INDEX idx_space_invitations_space_status ON space_invitations(space_id, status);

CREATE TABLE products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  space_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  product_type VARCHAR(60) NOT NULL,
  brand VARCHAR(60) NOT NULL,
  model_name VARCHAR(120) NULL,
  serial_number VARCHAR(120) NULL,
  purchased_on DATE NOT NULL,
  warranty_months INT NOT NULL,
  expires_on DATE NOT NULL,
  purchase_price DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  notes VARCHAR(1000) NULL,
  bill_key VARCHAR(255) NOT NULL,
  bill_content_type VARCHAR(50) NOT NULL,
  bill_size_bytes BIGINT NOT NULL,
  card_key VARCHAR(255) NULL,
  card_content_type VARCHAR(50) NULL,
  card_size_bytes BIGINT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_products_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_products_space_expiry ON products(space_id, expires_on);
CREATE INDEX idx_products_expiry ON products(expires_on);

CREATE TABLE notification_preferences (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  days_before INT NOT NULL DEFAULT 30,
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reminder_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  expires_on DATE NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_reminder_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminder_log_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT uq_reminder_log UNIQUE (user_id, product_id, expires_on)
);

CREATE TABLE reminder_runs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP NULL,
  trigger_source VARCHAR(20) NOT NULL,
  users_notified INT NOT NULL DEFAULT 0,
  products_reminded INT NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL,
  error VARCHAR(500) NULL
);

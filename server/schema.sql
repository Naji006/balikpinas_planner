CREATE DATABASE IF NOT EXISTS balikpinas_planner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE balikpinas_planner;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_login_limits (
  client_hash CHAR(64) NOT NULL PRIMARY KEY,
  window_started_at TIMESTAMP(3) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL,
  INDEX auth_login_limits_window_idx (window_started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT user_sessions_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  INDEX user_sessions_user_idx (user_id),
  INDEX user_sessions_expiry_idx (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS planner_data (
  user_id CHAR(36) NOT NULL,
  collection_name VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, collection_name),
  CONSTRAINT planner_data_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attachments (
  user_id CHAR(36) NOT NULL,
  attachment_id VARCHAR(64) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_data LONGBLOB NOT NULL,
  uploaded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, attachment_id),
  CONSTRAINT attachments_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  action VARCHAR(40) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  email VARCHAR(254) NULL,
  amount DECIMAL(12, 2) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT activity_log_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  INDEX activity_log_user_created_idx (user_id, created_at)
) ENGINE=InnoDB;
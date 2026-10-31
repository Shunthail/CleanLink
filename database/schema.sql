CREATE TABLE IF NOT EXISTS links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL,
  destination TEXT NOT NULL,
  removed_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  verdict ENUM('clear','caution') NOT NULL,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NULL,
  INDEX links_created (created_at DESC),
  INDEX links_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_clicks (
  link_id BIGINT UNSIGNED NOT NULL,
  visit_date DATE NOT NULL,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, visit_date),
  INDEX daily_date (visit_date),
  CONSTRAINT daily_link FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

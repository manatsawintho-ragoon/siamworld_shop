-- Migration 002: Add downloads table (fixed schema: filename, category)
CREATE TABLE IF NOT EXISTS downloads (
  id INT NOT NULL AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  file_size VARCHAR(50) DEFAULT NULL,
  download_url VARCHAR(1000) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

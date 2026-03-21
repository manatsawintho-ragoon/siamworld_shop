-- Migration 004: Fix downloads table for existing installations
-- Handles both: table doesn't exist yet, OR table has old column names (name/icon)

-- Step 1: Create with correct schema if not exists
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

-- Step 2: Rename 'name' -> 'filename' if old schema exists
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'downloads'
    AND COLUMN_NAME = 'name'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE downloads CHANGE COLUMN `name` `filename` VARCHAR(255) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 3: Rename 'icon' -> 'category' if old schema exists
SET @col_exists2 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'downloads'
    AND COLUMN_NAME = 'icon'
);
SET @sql2 = IF(@col_exists2 > 0,
  'ALTER TABLE downloads CHANGE COLUMN `icon` `category` VARCHAR(100) DEFAULT \'\'',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

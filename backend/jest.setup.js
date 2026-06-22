// Dummy env so config/index.ts validation passes when a test imports a module
// that transitively pulls in config. No real DB/Redis connection is made by the
// unit tests (the mysql pool is lazy and these tests only exercise pure logic).
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'test';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'test';
process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-at-least-32-chars';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

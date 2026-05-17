<?php
/**
 * KaisySales PHP Backend — Configuration
 *
 * 1. Edit $DB_* values to match your MySQL credentials in cPanel.
 * 2. Set $ALLOWED_ORIGIN to your frontend URL (or '*' during dev).
 */

// --- DATABASE CONFIGURATION ---
$DB_HOST = 'localhost';
$DB_NAME = 'kaisysales';
$DB_USER = 'root';
$DB_PASS = '';

// --- CORS ---
$ALLOWED_ORIGIN = '*'; // Change to 'https://yourdomain.com' in production

// --- TOKEN EXPIRY (days) ---
define('TOKEN_DAYS', 30);

// ----------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');

// CORS headers
if ($ALLOWED_ORIGIN === '*') {
  header('Access-Control-Allow-Origin: *');
} else {
  header('Access-Control-Allow-Origin: ' . $ALLOWED_ORIGIN);
  header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ----------------------------------------------------------------

function getDB(): PDO {
  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
  static $pdo = null;
  if ($pdo === null) {
    $pdo = new PDO(
      "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
      $DB_USER,
      $DB_PASS,
      [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
      ]
    );
  }
  return $pdo;
}

function jsonInput(): array {
  $raw = file_get_contents('php://input');
  return json_decode($raw, true) ?? [];
}

function jsonResponse(mixed $data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function errorResponse(string $message, int $code = 400): void {
  jsonResponse(['success' => false, 'error' => $message], $code);
}

/**
 * Generate a cryptographically secure token.
 */
function generateToken(): string {
  return bin2hex(random_bytes(48)); // 96 hex chars
}

/**
 * Authenticate the request via Bearer token.
 * Returns the users row or calls errorResponse on failure.
 */
function authenticate(): array {
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
    errorResponse('Missing or invalid Authorization header', 401);
  }
  $token = $m[1];
  $pdo = getDB();
  $stmt = $pdo->prepare(
    'SELECT u.* FROM users u
     JOIN auth_tokens t ON t.user_id = u.id
     WHERE t.token = :token AND t.expires_at > NOW()
     LIMIT 1'
  );
  $stmt->execute(['token' => $token]);
  $user = $stmt->fetch();
  if (!$user) {
    errorResponse('Invalid or expired token', 401);
  }
  return $user;
}

/**
 * Validate required fields exist in the given array.
 */
function requireFields(array $data, array $fields): void {
  foreach ($fields as $f) {
    if (!isset($data[$f]) || (is_string($data[$f]) && trim($data[$f]) === '')) {
      errorResponse("Missing required field: $f");
    }
  }
}

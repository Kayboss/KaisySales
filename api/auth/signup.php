<?php
require_once __DIR__ . '/../config.php';

$data = jsonInput();
requireFields($data, ['email', 'password']);

$email    = strtolower(trim($data['email']));
$password = $data['password'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  errorResponse('Invalid email address');
}
if (strlen($password) < 6) {
  errorResponse('Password must be at least 6 characters');
}

$pdo = getDB();

// Check duplicate
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
$stmt->execute(['email' => $email]);
if ($stmt->fetch()) {
  errorResponse('An account with this email already exists', 409);
}

// Create user
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare(
  'INSERT INTO users (email, password_hash, business_name, owner_name, phone, location, category, is_onboarded)
   VALUES (:email, :hash, :biz, :owner, :phone, :loc, :cat, 0)'
);
$stmt->execute([
  'email' => $email,
  'hash'  => $hash,
  'biz'   => $data['businessName'] ?? '',
  'owner' => $data['ownerName'] ?? '',
  'phone' => $data['phone'] ?? '',
  'loc'   => $data['location'] ?? '',
  'cat'   => $data['category'] ?? '',
]);

$userId = (int) $pdo->lastInsertId();

// Generate token
$token    = generateToken();
$expires  = date('Y-m-d H:i:s', strtotime('+' . TOKEN_DAYS . ' days'));
$stmt = $pdo->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (:uid, :token, :expires)');
$stmt->execute(['uid' => $userId, 'token' => $token, 'expires' => $expires]);

jsonResponse([
  'success' => true,
  'token'   => $token,
  'user'    => [
    'uid'          => (string) $userId,
    'email'        => $email,
    'businessName' => $data['businessName'] ?? '',
    'ownerName'    => $data['ownerName'] ?? '',
    'phone'        => $data['phone'] ?? '',
    'location'     => $data['location'] ?? '',
    'category'     => $data['category'] ?? '',
    'isOnboarded'  => false,
  ],
]);

<?php
require_once __DIR__ . '/../config.php';

$data = jsonInput();
requireFields($data, ['email', 'password']);

$email    = strtolower(trim($data['email']));
$password = $data['password'];

$pdo = getDB();

$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
  errorResponse('Invalid email or password', 401);
}

// Generate token
$token   = generateToken();
$expires = date('Y-m-d H:i:s', strtotime('+' . TOKEN_DAYS . ' days'));
$stmt = $pdo->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (:uid, :token, :expires)');
$stmt->execute(['uid' => $user['id'], 'token' => $token, 'expires' => $expires]);

jsonResponse([
  'success' => true,
  'token'   => $token,
  'user'    => [
    'uid'          => (string) $user['id'],
    'email'        => $user['email'],
    'businessName' => $user['business_name'],
    'ownerName'    => $user['owner_name'],
    'phone'        => $user['phone'],
    'location'     => $user['location'],
    'category'     => $user['category'],
    'avatarColor'  => $user['avatar_color'],
    'isOnboarded'  => (bool) $user['is_onboarded'],
  ],
]);

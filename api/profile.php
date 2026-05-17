<?php
require_once __DIR__ . '/config.php';

$user  = authenticate();
$uid   = (int) $user['id'];
$pdo   = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  jsonResponse([
    'success' => true,
    'data'    => [
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
}

if ($method === 'PUT') {
  $data = jsonInput();

  $fields = [];
  $params = ['id' => $uid];
  $map = [
    'businessName' => 'business_name',
    'ownerName'    => 'owner_name',
    'phone'        => 'phone',
    'location'     => 'location',
    'category'     => 'category',
    'avatarColor'  => 'avatar_color',
    'isOnboarded'  => 'is_onboarded',
  ];
  foreach ($map as $jsKey => $dbKey) {
    if (array_key_exists($jsKey, $data)) {
      $fields[] = "$dbKey = :$dbKey";
      $params[$dbKey] = $data[$jsKey];
    }
  }
  if (empty($fields)) {
    errorResponse('No fields to update');
  }

  $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);

  // Return updated profile
  $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
  $stmt->execute(['id' => $uid]);
  $updated = $stmt->fetch();

  jsonResponse([
    'success' => true,
    'data'    => [
      'uid'          => (string) $updated['id'],
      'email'        => $updated['email'],
      'businessName' => $updated['business_name'],
      'ownerName'    => $updated['owner_name'],
      'phone'        => $updated['phone'],
      'location'     => $updated['location'],
      'category'     => $updated['category'],
      'avatarColor'  => $updated['avatar_color'],
      'isOnboarded'  => (bool) $updated['is_onboarded'],
    ],
  ]);
}

errorResponse('Method not allowed', 405);

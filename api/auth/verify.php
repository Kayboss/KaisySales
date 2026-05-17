<?php
require_once __DIR__ . '/../config.php';

$user = authenticate();

jsonResponse([
  'success' => true,
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

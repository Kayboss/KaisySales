<?php
/**
 * Generic CRUD endpoint for all user-scoped collections.
 *
 * GET    /api/records.php?collection=sales       → list records
 * POST   /api/records.php?collection=sales       → create record
 * PUT    /api/records.php?collection=sales&id=X  → update record
 * DELETE /api/records.php?collection=sales&id=X  → delete record
 */
require_once __DIR__ . '/config.php';

$user       = authenticate();
$uid        = (int) $user['id'];
$pdo        = getDB();
$method     = $_SERVER['REQUEST_METHOD'];
$collection = $_GET['collection'] ?? '';
$recordId   = isset($_GET['id']) ? (int) $_GET['id'] : null;

// Collection to DB table mapping + allowed columns for INSERT/UPDATE
$collections = [
  'sales'      => ['item', 'category', 'quantity', 'unit_price', 'amount', 'payment_method', 'date', 'time'],
  'invoices'   => ['customer', 'date', 'total', 'status', 'items'],
  'expenses'   => ['title', 'amount', 'category', 'date', 'trend'],
  'inventory'  => ['name', 'category', 'quantity', 'unit', 'status'],
  'stores'     => ['name', 'type', 'location', 'phone', 'contact_name', 'status'],
  'categories' => ['name'],
];

if (!isset($collections[$collection])) {
  errorResponse("Invalid collection: $collection", 404);
}

$table     = $collection;
$columns   = $collections[$collection];

// ----------------------------------------------------------------

if ($method === 'GET') {
  $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE user_id = :uid ORDER BY id DESC");
  $stmt->execute(['uid' => $uid]);
  $rows = $stmt->fetchAll();

  // Normalise id to string for frontend consistency
  $rows = array_map(function ($r) {
    $r['id'] = (string) $r['id'];
    return $r;
  }, $rows);

  jsonResponse(['success' => true, 'data' => $rows]);
}

// ----------------------------------------------------------------

if ($method === 'POST') {
  $data = jsonInput();

  // Build INSERT
  $insertCols = ['user_id'];
  $placeholders = [':user_id'];
  $params = ['user_id' => $uid];

  foreach ($columns as $col) {
    $jsKey = $col; // The data key matches DB column name
    if (array_key_exists($jsKey, $data)) {
      $insertCols[] = "`$col`";
      $placeholders[] = ":$col";
      $params[$col] = is_array($data[$jsKey]) ? json_encode($data[$jsKey]) : $data[$jsKey];
    }
  }

  $sql = "INSERT INTO `$table` (" . implode(', ', $insertCols) . ') VALUES (' . implode(', ', $placeholders) . ')';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $newId = $pdo->lastInsertId();

  // Fetch the newly created record
  $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = :id LIMIT 1");
  $stmt->execute(['id' => $newId]);
  $record = $stmt->fetch();
  $record['id'] = (string) $record['id'];

  jsonResponse(['success' => true, 'data' => $record], 201);
}

// ----------------------------------------------------------------

if ($method === 'PUT') {
  if (!$recordId) errorResponse('Missing record id');

  $data = jsonInput();
  $sets = [];
  $params = ['id' => $recordId, 'user_id' => $uid];

  foreach ($columns as $col) {
    if (array_key_exists($col, $data)) {
      $sets[] = "`$col` = :$col";
      $params[$col] = is_array($data[$col]) ? json_encode($data[$col]) : $data[$col];
    }
  }

  if (empty($sets)) {
    errorResponse('No fields to update');
  }

  $sql = "UPDATE `$table` SET " . implode(', ', $sets) . " WHERE id = :id AND user_id = :user_id";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);

  if ($stmt->rowCount() === 0) {
    errorResponse('Record not found or access denied', 404);
  }

  // Return updated record
  $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = :id LIMIT 1");
  $stmt->execute(['id' => $recordId]);
  $record = $stmt->fetch();
  $record['id'] = (string) $record['id'];

  jsonResponse(['success' => true, 'data' => $record]);
}

// ----------------------------------------------------------------

if ($method === 'DELETE') {
  if (!$recordId) errorResponse('Missing record id');

  $stmt = $pdo->prepare("DELETE FROM `$table` WHERE id = :id AND user_id = :user_id");
  $stmt->execute(['id' => $recordId, 'user_id' => $uid]);

  if ($stmt->rowCount() === 0) {
    errorResponse('Record not found or access denied', 404);
  }

  jsonResponse(['success' => true]);
}

// ----------------------------------------------------------------

errorResponse('Method not allowed', 405);

<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://cabi.world');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$rawInput = file_get_contents('php://input');
$input = $rawInput ? json_decode($rawInput, true) : [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

$profilesDir = __DIR__ . '/../profiles';
$chatDir = __DIR__;
$messagesPerFile = 20;

function esc($str) {
    return htmlspecialchars($str, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// =============== СОЗДАНИЕ/ПОЛУЧЕНИЕ ПРОФИЛЯ ===============
if ($action === 'create_profile') {
    $hash = $input['hash'] ?? '';
    $data = $input['data'] ?? [];

    if ($hash === '' || !is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid hash or data']);
        exit;
    }

    $profilePath = $profilesDir . '/' . $hash;

    if (!is_dir($profilesDir)) {
        mkdir($profilesDir, 0755, true);
    }

    if (!is_dir($profilePath)) {
        mkdir($profilePath, 0755, true);

        $profile = [
            'name'       => 'Аноним',  // Имя по умолчанию
            'created'    => time(),
            'fingerprint' => $data
        ];

        file_put_contents(
            $profilePath . '/profile.json',
            json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
        );
    } else {
        $profileJson = file_get_contents($profilePath . '/profile.json');
        $profile = $profileJson ? json_decode($profileJson, true) : [
            'name'        => 'Аноним',
            'fingerprint' => []
        ];
    }

    echo json_encode([
        'success' => true,
        'hash'    => $hash,
        'profile' => $profile
    ]);
    exit;
}

// =============== СМЕНА ИМЕНИ ===============
if ($action === 'update_name') {
    $hash = $input['hash'] ?? '';
    $newName = trim($input['name'] ?? '');

    if (!$hash || $newName === '' || mb_strlen($newName) > 20) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }

    $profileFile = $profilesDir . '/' . $hash . '/profile.json';
    if (file_exists($profileFile)) {
        $profile = json_decode(file_get_contents($profileFile), true);
        $profile['name'] = $newName;
        file_put_contents($profileFile, json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'name' => $newName]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Profile not found']);
    }
    exit;
}

// =============== ПОЛУЧЕНИЕ СООБЩЕНИЙ (GET) ===============
if ($_SERVER['REQUEST_METHOD'] === 'GET' && empty($action)) {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $file = $chatDir . '/chat_' . $page . '.json';

    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?: [];
        usort($data, fn($a, $b) => $b['timestamp'] - $a['timestamp']);
        $hasMore = file_exists($chatDir . '/chat_' . ($page + 1) . '.json');
        echo json_encode(['messages' => $data, 'page' => $page, 'has_more' => $hasMore]);
    } else {
        echo json_encode(['messages' => [], 'page' => $page, 'has_more' => false]);
    }
    exit;
}

// =============== ОТПРАВКА СООБЩЕНИЯ (POST без action) ===============
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($action)) {
    $name = trim($input['name'] ?? '');
    $text = trim($input['text'] ?? '');
    $hash = $input['hash'] ?? '';  // ВАЖНО: получаем hash

    if ($name === '' || mb_strlen($name) > 20) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid name']);
        exit;
    }
    if ($text === '' || mb_strlen($text) > 200) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid message']);
        exit;
    }
    if ($hash === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid hash']);
        exit;
    }

    // Антифлуд
    $ipFile = $chatDir . '/last_' . md5($_SERVER['REMOTE_ADDR']);
    if (file_exists($ipFile) && time() - filemtime($ipFile) < 3) {
        http_response_code(429);
        echo json_encode(['error' => 'Too fast']);
        exit;
    }
    touch($ipFile);

    // Генерируем уникальный ID сообщения
    $messageId = $hash . '_' . time() . '_' . bin2hex(random_bytes(4));

    $newMsg = [
        'id'        => $messageId,
        'hash'      => $hash,  // Сохраняем hash отправителя
        'name'      => esc($name),
        'text'      => esc($text),
        'timestamp' => time(),
        'edited'    => false
    ];

    $latestPage = 1;
    while (file_exists($chatDir . '/chat_' . ($latestPage + 1) . '.json')) {
        $latestPage++;
    }

    $file = $chatDir . '/chat_' . $latestPage . '.json';
    $messages = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
    $messages[] = $newMsg;

    if (count($messages) > $messagesPerFile) {
        file_put_contents($file, json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        $latestPage++;
        $file = $chatDir . '/chat_' . $latestPage . '.json';
        $messages = [$newMsg];
    }

    file_put_contents($file, json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    echo json_encode(['success' => true, 'message' => $newMsg]);
    exit;
}

// =============== РЕДАКТИРОВАНИЕ СООБЩЕНИЯ ===============
if ($action === 'edit_message') {
    $hash = $input['hash'] ?? '';
    $messageId = $input['message_id'] ?? '';
    $newText = trim($input['text'] ?? '');

    if (!$hash || !$messageId || $newText === '' || mb_strlen($newText) > 200) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }

    // Ищем сообщение во всех файлах
    $found = false;
    $page = 1;
    while (file_exists($chatDir . '/chat_' . $page . '.json')) {
        $file = $chatDir . '/chat_' . $page . '.json';
        $messages = json_decode(file_get_contents($file), true) ?: [];
        
        foreach ($messages as &$msg) {
            if ($msg['id'] === $messageId && $msg['hash'] === $hash) {
                $msg['text'] = esc($newText);
                $msg['edited'] = true;
                $found = true;
                
                file_put_contents($file, json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                echo json_encode(['success' => true, 'message' => $msg]);
                exit;
            }
        }
        $page++;
    }

    if (!$found) {
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
    }
    exit;
}

// =============== УДАЛЕНИЕ СООБЩЕНИЯ ===============
if ($action === 'delete_message') {
    $hash = $input['hash'] ?? '';
    $messageId = $input['message_id'] ?? '';

    if (!$hash || !$messageId) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }

    // Ищем и удаляем сообщение
    $found = false;
    $page = 1;
    while (file_exists($chatDir . '/chat_' . $page . '.json')) {
        $file = $chatDir . '/chat_' . $page . '.json';
        $messages = json_decode(file_get_contents($file), true) ?: [];
        $originalCount = count($messages);
        
        $messages = array_values(array_filter($messages, function($msg) use ($messageId, $hash, &$found) {
            if ($msg['id'] === $messageId && $msg['hash'] === $hash) {
                $found = true;
                return false;
            }
            return true;
        }));

        if ($found) {
            file_put_contents($file, json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            echo json_encode(['success' => true]);
            exit;
        }
        $page++;
    }

    if (!$found) {
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
    }
    exit;
}

// Если ничего не подошло
http_response_code(405);
echo json_encode(['error' => 'Invalid request']);
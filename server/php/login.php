<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$serverRoot = dirname(__DIR__);
$envFile = $serverRoot . '/.env';
$fileConfig = is_file($envFile) ? parse_ini_file($envFile, false, INI_SCANNER_RAW) : [];
if (!is_array($fileConfig)) {
    $fileConfig = [];
}

function configValue(string $key, string $default = ''): string
{
    global $fileConfig;
    $environmentValue = getenv($key);
    if ($environmentValue !== false) {
        return $environmentValue;
    }
    return isset($fileConfig[$key]) ? (string) $fileConfig[$key] : $default;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

$defaultOrigins = 'http://localhost:3000,http://localhost:4200,http://localhost:8100,http://127.0.0.1:3000,http://127.0.0.1:4200,http://127.0.0.1:8100,https://localhost,capacitor://localhost';
$allowedOrigins = array_filter(array_map('trim', explode(',', configValue('APP_ORIGINS', $defaultOrigins))));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    respond(403, ['error' => 'Origin is not allowed']);
}
if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

$request = json_decode(file_get_contents('php://input'), true);
$email = is_array($request) && is_string($request['email'] ?? null)
    ? strtolower(trim($request['email']))
    : '';
$password = is_array($request) && is_string($request['password'] ?? null)
    ? $request['password']
    : '';
if ($email === '' || strlen($email) > 254 || $password === '') {
    respond(400, ['error' => 'Email and password are required']);
}

try {
    $database = new mysqli(
        configValue('DB_HOST', '127.0.0.1'),
        configValue('DB_USER', 'root'),
        configValue('DB_PASSWORD'),
        configValue('DB_NAME', 'balikpinas_planner'),
        (int) configValue('DB_PORT', '3306')
    );
    $database->set_charset('utf8mb4');

    $database->query(
        'DELETE FROM auth_login_limits
         WHERE window_started_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 DAY)'
    );
    $clientHash = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $limit = $database->prepare(
        'INSERT INTO auth_login_limits (client_hash, window_started_at, attempts)
         VALUES (?, CURRENT_TIMESTAMP(3), 1)
         ON DUPLICATE KEY UPDATE
           attempts = IF(window_started_at <= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 15 MINUTE), 1, attempts + 1),
           window_started_at = IF(window_started_at <= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 15 MINUTE), CURRENT_TIMESTAMP(3), window_started_at)'
    );
    $limit->bind_param('s', $clientHash);
    $limit->execute();
    $limit->close();

    $attemptCount = $database->prepare(
        'SELECT attempts FROM auth_login_limits WHERE client_hash = ?'
    );
    $attemptCount->bind_param('s', $clientHash);
    $attemptCount->execute();
    $attemptCount->bind_result($attempts);
    $attemptCount->fetch();
    $attemptCount->close();
    if ($attempts > 20) {
        $database->close();
        respond(429, ['error' => 'Too many login attempts. Please try again later']);
    }

    $lookup = $database->prepare(
        'SELECT id, email, password_hash, full_name, phone FROM users WHERE email = ? LIMIT 1'
    );
    $lookup->bind_param('s', $email);
    $lookup->execute();
    $lookup->bind_result($userId, $storedEmail, $passwordHash, $fullName, $phone);
    $foundUser = $lookup->fetch();
    $lookup->close();

    if (!$foundUser || !password_verify($password, $passwordHash)) {
        respond(401, ['error' => 'Email or password is incorrect']);
    }

    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $session = $database->prepare(
        'INSERT INTO user_sessions (token_hash, user_id, expires_at)
         VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 7 DAY))'
    );
    $session->bind_param('ss', $tokenHash, $userId);
    $session->execute();
    $session->close();
    $database->close();

    $sameSite = strtolower(configValue('COOKIE_SAME_SITE', 'lax'));
    if (!in_array($sameSite, ['lax', 'strict', 'none'], true)) {
        $sameSite = 'lax';
    }
    $secure = configValue('COOKIE_SECURE', 'false') === 'true' || $sameSite === 'none';
    setcookie('balikpinas_session', $token, [
        'expires' => time() + 7 * 24 * 60 * 60,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => $sameSite
    ]);

    respond(200, [
        'id' => $userId,
        'email' => $storedEmail,
        'fullName' => $fullName,
        'phone' => $phone
    ]);
} catch (Throwable $error) {
    respond(500, ['error' => 'Unable to reach the sign-in service']);
}
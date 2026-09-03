<?php
// Contact form handler.
//
// The website runs on cyon shared hosting, which serves static files but does
// run PHP — so the enquiry is sent straight from the web server's own mail
// system. That needs no mailbox and no SMTP login, and because this file sits
// on the site's own domain there is no cross-origin request to allow.

declare(strict_types=1);

const TO_EMAIL   = 'welcome@bollag.net';
const FROM_EMAIL = 'noreply@bollag-guggenheim.ch';

/** Header values must never contain newlines, or a sender could inject extra headers. */
function headerSafe(string $value): string {
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], ' ', $value));
}

function wantsJson(): bool {
    $accept = strtolower($_SERVER['HTTP_ACCEPT'] ?? '');
    return str_contains($accept, 'application/json');
}

function respond(int $status, array $body, int $sentFlag): void {
    if (wantsJson()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body);
        exit;
    }
    // Without JavaScript the browser follows a redirect back to the page.
    http_response_code(303);
    header('Location: /contact/?sent=' . $sentFlag);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Method not allowed.'], 0);
}

// site.js posts JSON; a no-JavaScript submit posts a normal form body.
$payload = $_POST;
$contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
if (str_contains($contentType, 'application/json')) {
    $decoded = json_decode(file_get_contents('php://input') ?: '', true);
    $payload = is_array($decoded) ? $decoded : [];
}

$value = static fn(string $key): string => trim((string)($payload[$key] ?? ''));

// Bots fill every field, including the one hidden from people. Accept the
// submission so they get no feedback, but send nothing.
if ($value('website') !== '') {
    respond(200, ['ok' => true, 'message' => 'Thanks. Your message has been sent.'], 1);
}

$firstName = $value('first_name');
$lastName  = $value('last_name');
$email     = $value('email');
$company   = $value('company');
$subject   = $value('subject');
$message   = $value('message');

foreach ([$firstName, $lastName, $email, $subject, $message] as $required) {
    if ($required === '') {
        respond(400, ['error' => 'Please complete all required fields.'], 0);
    }
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Please enter a valid email address.'], 0);
}

$body = "New enquiry from the website\n\n"
      . "Name:    {$firstName} {$lastName}\n"
      . "Email:   {$email}\n"
      . ($company !== '' ? "Company: {$company}\n" : '')
      . "Subject: {$subject}\n\n"
      . "Message:\n{$message}\n";

$headers = [
    'From: Bollag-Guggenheim Website <' . FROM_EMAIL . '>',
    // So a reply in the inbox goes straight back to the enquirer.
    'Reply-To: ' . headerSafe($firstName . ' ' . $lastName) . ' <' . headerSafe($email) . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
];

$sent = mail(
    TO_EMAIL,
    '[Website] ' . headerSafe($subject),
    $body,
    implode("\r\n", $headers),
    '-f' . FROM_EMAIL
);

if (!$sent) {
    error_log('send-enquiry.php: mail() returned false');
    respond(500, ['error' => 'Could not send your message right now.'], 0);
}

respond(200, ['ok' => true, 'message' => 'Thanks. Your message has been sent.'], 1);

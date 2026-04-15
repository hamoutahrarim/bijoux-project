<?php
/**
 * ══════════════════════════════════════════════════════════════════
 *  Seira Jewels — Backend PHP / MySQL
 *  Fichier : db.php
 *  Rôle    : point d'entrée unique pour toutes les opérations BD
 *            + notifications SSE en temps réel
 * ══════════════════════════════════════════════════════════════════
 *
 *  ROUTES DISPONIBLES  (?action=...)
 *  ─────────────────────────────────
 *  POST  ?action=create_order          Créer une commande
 *  GET   ?action=get_orders            Lister toutes les commandes (admin)
 *  GET   ?action=get_order&id=X        Détail d'une commande
 *  POST  ?action=update_status         Changer statut d'une commande
 *  GET   ?action=notifications         Stream SSE (temps réel admin)
 *  GET   ?action=setup                 Créer les tables (première fois)
 *  POST  ?action=delete_order          Supprimer une commande (admin)
 */

// ────────────────────────────────────────────────────────────────
//  0. CONFIGURATION — à adapter avant déploiement
// ────────────────────────────────────────────────────────────────
// 0. CONFIGURATION — MAMP (Mac)
define('DB_HOST',     'localhost');
define('DB_NAME',     'seira_db');
define('DB_USER',     'root');
define('DB_PASS',     'root');
define('DB_CHARSET',  'utf8mb4');
// Clé secrète pour les routes admin (changez-la !)
define('ADMIN_SECRET', 'seira_admin_2024_secret');

// Origines autorisées pour CORS (votre domaine en prod)
define('ALLOWED_ORIGIN', '*');  // remplacez par 'https://votre-domaine.com' en prod


// ────────────────────────────────────────────────────────────────
//  1. HEADERS COMMUNS
// ────────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: '  . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Key');

// Répondre directement aux preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}


// ────────────────────────────────────────────────────────────────
//  2. CONNEXION PDO
// ────────────────────────────────────────────────────────────────
function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST, DB_NAME, DB_CHARSET
    );
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        json_error(500, 'Connexion BD impossible : ' . $e->getMessage());
    }
    return $pdo;
}


// ────────────────────────────────────────────────────────────────
//  3. HELPERS
// ────────────────────────────────────────────────────────────────
function json_ok(array $data = [], int $code = 200): never {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(int $code, string $message): never {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function is_admin(): bool {
    // Vérifie la clé admin dans le header OU dans $_GET
    $key = $_SERVER['HTTP_X_ADMIN_KEY']
        ?? $_GET['admin_key']
        ?? '';
    return hash_equals(ADMIN_SECRET, $key);
}

function require_admin(): void {
    if (!is_admin()) {
        json_error(403, 'Accès refusé — clé admin manquante ou invalide.');
    }
}

function get_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function sanitize_string(mixed $val, int $max = 255): string {
    return mb_substr(trim((string)($val ?? '')), 0, $max);
}


// ────────────────────────────────────────────────────────────────
//  4. ROUTER
// ────────────────────────────────────────────────────────────────
$action = $_GET['action'] ?? '';

match ($action) {
    'setup'         => action_setup(),
    'create_order'  => action_create_order(),
    'get_orders'    => action_get_orders(),
    'get_order'     => action_get_order(),
    'update_status' => action_update_status(),
    'delete_order'  => action_delete_order(),
    'notifications' => action_notifications(),
    default         => json_error(400, "Action inconnue : \"$action\""),
};


// ════════════════════════════════════════════════════════════════
//  ACTIONS
// ════════════════════════════════════════════════════════════════

/**
 * SETUP — Créer les tables (à appeler UNE SEULE fois)
 * GET /db.php?action=setup&admin_key=VOTRE_CLE
 */
function action_setup(): never {
    require_admin();
    $pdo = get_pdo();

    // Table commandes
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS commandes (
            id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prenom      VARCHAR(100)  NOT NULL,
            nom         VARCHAR(100)  NOT NULL,
            telephone   VARCHAR(30)   NOT NULL,
            adresse     TEXT          NOT NULL,
            ville       VARCHAR(100)  NOT NULL,
            articles    JSON          NOT NULL,
            total       DECIMAL(10,2) NOT NULL DEFAULT 0,
            statut      ENUM(
                            'nouvelle',
                            'confirmee',
                            'en_preparation',
                            'expediee',
                            'livree',
                            'annulee'
                        ) NOT NULL DEFAULT 'nouvelle',
            notes       TEXT          NULL,
            created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Table notifications (pour le SSE)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            type        VARCHAR(50)  NOT NULL,
            payload     JSON         NOT NULL,
            lu          TINYINT(1)   NOT NULL DEFAULT 0,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    json_ok(['message' => 'Tables créées avec succès ✅']);
}


/**
 * CREATE ORDER — Enregistrer une nouvelle commande
 * POST /db.php?action=create_order
 * Body JSON : { prenom, nom, telephone, adresse, ville, articles[], total }
 */
function action_create_order(): never {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error(405, 'Méthode non autorisée — utilisez POST.');
    }

    $body = get_body();

    // Validation des champs obligatoires
    $required = ['prenom', 'nom', 'telephone', 'adresse', 'ville', 'articles'];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            json_error(422, "Champ obligatoire manquant : \"$field\"");
        }
    }

    if (!is_array($body['articles']) || count($body['articles']) === 0) {
        json_error(422, 'Le panier est vide.');
    }

    // Nettoyage
    $prenom    = sanitize_string($body['prenom']);
    $nom       = sanitize_string($body['nom']);
    $telephone = sanitize_string($body['telephone'], 30);
    $adresse   = sanitize_string($body['adresse'], 500);
    $ville     = sanitize_string($body['ville']);
    $articles  = $body['articles'];

    // Recalcul du total côté serveur (sécurité)
    $total = 0;
    foreach ($articles as $item) {
        $price = floatval($item['price'] ?? 0);
        $qty   = intval($item['qty']   ?? 1);
        if ($price < 0 || $qty < 1 || $qty > 100) {
            json_error(422, 'Article invalide dans le panier.');
        }
        $total += $price * $qty;
    }

    $pdo = get_pdo();

    // Insertion commande
    $stmt = $pdo->prepare("
        INSERT INTO commandes
            (prenom, nom, telephone, adresse, ville, articles, total, statut)
        VALUES
            (:prenom, :nom, :telephone, :adresse, :ville, :articles, :total, 'nouvelle')
    ");
    $stmt->execute([
        ':prenom'    => $prenom,
        ':nom'       => $nom,
        ':telephone' => $telephone,
        ':adresse'   => $adresse,
        ':ville'     => $ville,
        ':articles'  => json_encode($articles, JSON_UNESCAPED_UNICODE),
        ':total'     => $total,
    ]);

    $order_id = (int)$pdo->lastInsertId();

    // Insertion notification (pour le SSE admin)
    $notif_payload = json_encode([
        'order_id' => $order_id,
        'client'   => "$prenom $nom",
        'ville'    => $ville,
        'total'    => $total,
        'nb_items' => count($articles),
    ], JSON_UNESCAPED_UNICODE);

    $pdo->prepare("
        INSERT INTO notifications (type, payload)
        VALUES ('nouvelle_commande', :payload)
    ")->execute([':payload' => $notif_payload]);

    json_ok([
        'order_id' => $order_id,
        'message'  => 'Commande enregistrée avec succès.',
        'total'    => $total,
    ], 201);
}


/**
 * GET ORDERS — Lister toutes les commandes
 * GET /db.php?action=get_orders&admin_key=CLE[&statut=nouvelle][&limit=50][&offset=0]
 */
function action_get_orders(): never {
    require_admin();
    $pdo = get_pdo();

    $where  = [];
    $params = [];

    // Filtre par statut
    $statuts_valides = ['nouvelle','confirmee','en_preparation','expediee','livree','annulee'];
    if (!empty($_GET['statut']) && in_array($_GET['statut'], $statuts_valides)) {
        $where[]           = 'statut = :statut';
        $params[':statut'] = $_GET['statut'];
    }

    // Filtre par ville
    if (!empty($_GET['ville'])) {
        $where[]          = 'ville = :ville';
        $params[':ville'] = sanitize_string($_GET['ville']);
    }

    // Pagination
    $limit  = min((int)($_GET['limit']  ?? 50), 200);
    $offset = max((int)($_GET['offset'] ?? 0),    0);

    $sql = 'SELECT id, prenom, nom, telephone, ville, total, statut, created_at
            FROM commandes';

    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';

    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $orders = $stmt->fetchAll();

    // Compte total
    $count_sql = 'SELECT COUNT(*) FROM commandes';
    if ($where) $count_sql .= ' WHERE ' . implode(' AND ', $where);
    $count_stmt = $pdo->prepare($count_sql);
    foreach ($params as $k => $v) $count_stmt->bindValue($k, $v);
    $count_stmt->execute();
    $total_count = (int)$count_stmt->fetchColumn();

    json_ok([
        'orders'      => $orders,
        'total_count' => $total_count,
        'limit'       => $limit,
        'offset'      => $offset,
    ]);
}


/**
 * GET ORDER — Détail d'une commande (avec articles)
 * GET /db.php?action=get_order&id=X&admin_key=CLE
 */
function action_get_order(): never {
    require_admin();

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) json_error(400, 'ID invalide.');

    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT * FROM commandes WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $order = $stmt->fetch();

    if (!$order) json_error(404, "Commande #$id introuvable.");

    // Décoder le JSON articles
    $order['articles'] = json_decode($order['articles'], true);

    json_ok(['order' => $order]);
}


/**
 * UPDATE STATUS — Changer le statut d'une commande
 * POST /db.php?action=update_status&admin_key=CLE
 * Body JSON : { id, statut, notes? }
 */
function action_update_status(): never {
    require_admin();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error(405, 'Méthode non autorisée — utilisez POST.');
    }

    $body   = get_body();
    $id     = (int)($body['id']     ?? 0);
    $statut = sanitize_string($body['statut'] ?? '');
    $notes  = sanitize_string($body['notes']  ?? '', 1000);

    if ($id <= 0) json_error(400, 'ID invalide.');

    $statuts_valides = ['nouvelle','confirmee','en_preparation','expediee','livree','annulee'];
    if (!in_array($statut, $statuts_valides)) {
        json_error(422, "Statut invalide : \"$statut\"");
    }

    $pdo = get_pdo();

    // Vérifier que la commande existe
    $check = $pdo->prepare('SELECT id, prenom, nom, ville FROM commandes WHERE id = :id');
    $check->execute([':id' => $id]);
    $order = $check->fetch();
    if (!$order) json_error(404, "Commande #$id introuvable.");

    // Mettre à jour
    $sql    = 'UPDATE commandes SET statut = :statut';
    $params = [':statut' => $statut, ':id' => $id];
    if ($notes !== '') {
        $sql            .= ', notes = :notes';
        $params[':notes'] = $notes;
    }
    $sql .= ' WHERE id = :id';

    $pdo->prepare($sql)->execute($params);

    // Notification de changement de statut
    $notif_payload = json_encode([
        'order_id' => $id,
        'client'   => $order['prenom'] . ' ' . $order['nom'],
        'ville'    => $order['ville'],
        'statut'   => $statut,
    ], JSON_UNESCAPED_UNICODE);

    $pdo->prepare("
        INSERT INTO notifications (type, payload)
        VALUES ('statut_modifie', :payload)
    ")->execute([':payload' => $notif_payload]);

    json_ok([
        'order_id' => $id,
        'statut'   => $statut,
        'message'  => "Statut mis à jour → $statut",
    ]);
}


/**
 * DELETE ORDER — Supprimer une commande
 * POST /db.php?action=delete_order&admin_key=CLE
 * Body JSON : { id }
 */
function action_delete_order(): never {
    require_admin();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error(405, 'Méthode non autorisée — utilisez POST.');
    }

    $body = get_body();
    $id   = (int)($body['id'] ?? 0);
    if ($id <= 0) json_error(400, 'ID invalide.');

    $pdo = get_pdo();
    $stmt = $pdo->prepare('DELETE FROM commandes WHERE id = :id');
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        json_error(404, "Commande #$id introuvable.");
    }

    json_ok(['message' => "Commande #$id supprimée."]);
}


/**
 * NOTIFICATIONS SSE — Stream en temps réel pour l'admin
 * GET /db.php?action=notifications&admin_key=CLE&last_id=X
 *
 * Le client JS ouvre une EventSource et reçoit les nouvelles
 * commandes / changements de statut au fur et à mesure.
 */
function action_notifications(): never {
    require_admin();

    // Headers SSE
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');   // Nginx : désactiver le buffering
    header('Connection: keep-alive');

    // Désactiver le output buffering PHP
    if (ob_get_level()) ob_end_clean();

    $last_id = (int)($_GET['last_id'] ?? 0);
    $pdo     = get_pdo();

    // Envoyer un ping initial pour confirmer la connexion
    echo "event: connected\n";
    echo "data: {\"message\":\"SSE connecté — en attente de commandes\"}\n\n";
    flush();

    // Boucle de polling longue (max 30s pour éviter timeouts Apache)
    $start   = time();
    $timeout = 28; // secondes

    while ((time() - $start) < $timeout) {
        // Chercher de nouvelles notifications depuis last_id
        $stmt = $pdo->prepare("
            SELECT id, type, payload, created_at
            FROM notifications
            WHERE id > :last_id AND lu = 0
            ORDER BY id ASC
            LIMIT 20
        ");
        $stmt->execute([':last_id' => $last_id]);
        $rows = $stmt->fetchAll();

        foreach ($rows as $row) {
            $last_id = (int)$row['id'];

            $event_data = json_encode([
                'id'         => $last_id,
                'type'       => $row['type'],
                'payload'    => json_decode($row['payload'], true),
                'created_at' => $row['created_at'],
            ], JSON_UNESCAPED_UNICODE);

            // Format SSE standard
            echo "id: $last_id\n";
            echo "event: {$row['type']}\n";
            echo "data: $event_data\n\n";
            flush();

            // Marquer comme lu
            $pdo->prepare('UPDATE notifications SET lu = 1 WHERE id = :id')
                ->execute([':id' => $last_id]);
        }

        // Heartbeat toutes les 5s pour garder la connexion vivante
        if (empty($rows)) {
            echo ": heartbeat\n\n";
            flush();
            sleep(2);
        }

        // Vérifier si le client est encore connecté
        if (connection_aborted()) break;
    }

    // Le client doit reconnecter (comportement SSE natif)
    echo "event: reconnect\n";
    echo "data: {\"last_id\":$last_id}\n\n";
    flush();
    exit;
}

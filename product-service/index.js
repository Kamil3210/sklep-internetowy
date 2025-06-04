// sklep-internetowy/product-service/index.js
const express = require('express');
const db = require('./db'); // Upewnij się, że ten plik poprawnie eksportuje 'query' i 'pool' oraz 'initializeDatabase'
const cors = require('cors');
const session = require('express-session');
const Keycloak = require('keycloak-connect');

const app = express();
const port = process.env.PORT || 3001;

// --- Konfiguracja Sesji ---
// Wymagana przez keycloak-connect. W produkcji użyj trwałego store'a.
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: process.env.SESSION_SECRET || 'ZMIEN_TEN_SEKRET_W_PLIKU_ENV_NA_COS_BEZPIECZNEGO_DLA_PRODUCT_SERVICE!',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// --- Konfiguracja Keycloak Connect ---
const keycloakConfig = {
    realm: process.env.KEYCLOAK_REALM || 'sklep-realm',
    "auth-server-url": process.env.KEYCLOAK_AUTH_SERVER_URL || 'http://keycloak:8080/', // URL do Keycloaka w sieci Docker, z ukośnikiem!
    "ssl-required": "external", // W dewelopmencie, dla produkcji rozważ "all"
    resource: process.env.KEYCLOAK_CLIENT_ID || 'sklep-backend-client', // Client ID tego serwisu w Keycloak
    "bearer-only": true, // Ten serwis tylko weryfikuje tokeny
    // "public-client": true, // Alternatywa, jeśli klient w Keycloak nie ma "Client authentication: On" i nie jest "bearer-only"
    // Jeśli klient w Keycloak jest 'confidential' (Client authentication: On), i nie używasz bearer-only, dodaj:
    // "credentials": {
    //     "secret": process.env.KEYCLOAK_CLIENT_SECRET // Wartość z zakładki Credentials klienta w Keycloak
    // }
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// --- Middlewares (w odpowiedniej kolejności) ---
app.use(cors());        // 1. CORS
app.use(express.json()); // 2. Body Parser dla JSON

// 3. Middleware Keycloaka - po sesji, przed chronionymi trasami
app.use(keycloak.middleware({
    logout: '/logout', // Opcjonalna obsługa wylogowania przez Keycloak
    admin: '/'         // Opcjonalna ścieżka do panelu admina Keycloak (nie naszej aplikacji)
}));

// --- Inicjalizacja Bazy Danych ---
db.initializeDatabase().catch(err => {
    console.error("Product service: Failed to initialize database (product_service_db) on startup:", err);
    process.exit(1);
});

// --- Endpointy API ---

// Healthcheck endpoint - publiczny
app.get('/health', (req, res) => {
    console.log("Product service: /health endpoint called");
    res.status(200).json({ status: 'UP', message: 'Product service is healthy!' });
});

// GET /products - publiczny
app.get('/products', async (req, res) => {
    console.log("Product service: GET /products called");
    try {
        const { rows } = await db.query('SELECT * FROM products ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error("Error in GET /products:", err.message);
        res.status(500).send('Server error');
    }
});

// GET /products/:id - publiczny
app.get('/products/:id', async (req, res) => {
    const productIdParam = req.params.id;
    console.log(`Product service: GET /products/${productIdParam} called`);
    try {
        const productId = parseInt(productIdParam);
        if (isNaN(productId)) {
            return res.status(400).send('Invalid product ID');
        }
        const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).send('Product not found');
        }
    } catch (err) {
        console.error(`Error in GET /products/${productIdParam}:`, err.message);
        res.status(500).send('Server error');
    }
});

// POST /products - ZABEZPIECZONY, wymaga roli 'admin'
app.post('/products', keycloak.protect(), async (req, res) => { // <<< TYMCZASOWA ZMIANA (bez 'realm:admin')
    console.log("Product service: POST /products called (protected - ANY AUTHENTICATED USER)");
    if (req.kauth && req.kauth.grant && req.kauth.grant.access_token && req.kauth.grant.access_token.content) {
        console.log("User making request:", req.kauth.grant.access_token.content.preferred_username);
        console.log("User roles from token:", req.kauth.grant.access_token.content.realm_access.roles);
    } else {
        console.log("User information (req.kauth.grant) not available.");
    }

    const { name, price, category } = req.body;
    if (name === undefined || String(name).trim() === '' || price == null || category === undefined) {
        return res.status(400).send('Missing or invalid name, price, or category. All fields are required and name cannot be empty.');
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        return res.status(400).send('Invalid price value. Must be a non-negative number.');
    }
    if (typeof category !== 'string') { // Kategoria może być pusta, ale musi być stringiem
        return res.status(400).send('Category must be a string.');
    }

    try {
        const { rows } = await db.query(
            'INSERT INTO products (name, price, category) VALUES ($1, $2, $3) RETURNING *',
            [String(name).trim(), parseFloat(price), category]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("Error in POST /products database operation:", err.message, err.stack);
        res.status(500).send('Server error during database operation.');
    }
});

// PUT /products/:id - ZABEZPIECZONY, wymaga roli 'admin'
app.put('/products/:id', keycloak.protect('realm:admin'), async (req, res) => {
    console.log(`Product service: PUT /products/${req.params.id} called (protected by realm:admin role)`);
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
        return res.status(400).send('Invalid product ID.');
    }

    const { name, price, category } = req.body;
    if (name === undefined && price === undefined && category === undefined) {
        return res.status(400).send('No fields provided for update. At least one field (name, price, category) is required.');
    }

    const fieldsToUpdate = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') return res.status(400).send('If provided, name must be a non-empty string.');
        fieldsToUpdate.name = String(name).trim();
    }
    if (price !== undefined) {
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) return res.status(400).send('If provided, price must be a non-negative number.');
        fieldsToUpdate.price = parseFloat(price);
    }
    if (category !== undefined) {
        if (typeof category !== 'string') return res.status(400).send('If provided, category must be a string.');
        fieldsToUpdate.category = category;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
         return res.status(400).send("No valid updatable fields provided.");
    }

    const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`);
    const values = Object.values(fieldsToUpdate);
    values.push(productId); // For the WHERE clause

    // Poprawka: updated_at powinno być aktualizowane przez trigger, ale jeśli chcesz jawnie:
    // setClauses.push('updated_at = CURRENT_TIMESTAMP'); 
    // Jeśli polegasz na triggerze, nie dodawaj updated_at tutaj.
    // Zakładając, że trigger działa, nie musimy tu dodawać updated_at.
    const queryText = `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`;
    
    try {
        const { rows } = await db.query(queryText, values);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).send('Product not found.');
        }
    } catch (err) {
        console.error(`Error in PUT /products/${req.params.id} database operation:`, err.message, err.stack);
        res.status(500).send('Server error during database operation.');
    }
});

// DELETE /products/:id - ZABEZPIECZONY, wymaga roli 'admin'
app.delete('/products/:id', keycloak.protect('realm:admin'), async (req, res) => {
    console.log(`Product service: DELETE /products/${req.params.id} called (protected by realm:admin role)`);
    const productId = parseInt(req.params.id);
     if (isNaN(productId)) {
        return res.status(400).send('Invalid product ID.');
    }
    try {
        const { rows } = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
        if (rows.length > 0) {
            res.json({ message: 'Product deleted successfully', product: rows[0] });
        } else {
            res.status(404).send('Product not found.');
        }
    } catch (err) {
        console.error(`Error in DELETE /products/${req.params.id} database operation:`, err.message, err.stack);
        res.status(500).send('Server error during database operation.');
    }
});

// --- Start Serwera ---
app.listen(port, () => {
    console.log(`Product service listening on port ${port}. Keycloak integration active.`);
    console.log(`Keycloak config: realm='${keycloakConfig.realm}', auth-server-url='${keycloakConfig['auth-server-url']}', client-id='${keycloakConfig.resource}'`);
});

// --- Obsługa Graceful Shutdown ---
const gracefulShutdown = async () => {
    console.log('Shutting down product_service gracefully...');
    try {
        if (db.pool) { 
            await db.pool.end();
            console.log('PostgreSQL pool (product_service_db) has been closed.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error during pool shutdown (product_service_db)', error.stack);
        process.exit(1);
    }
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

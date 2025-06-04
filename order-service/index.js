// order-service/index.js
const express = require('express');
const db = require('./db');
const axios = require('axios');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3002;

const PRODUCT_SERVICE_BASE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';

// --- Konfiguracja Sesji ---
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: process.env.SESSION_SECRET || 'ZMIEN_TEN_SEKRET_W_PLIKU_ENV_NA_COS_BEZPIECZNEGO_DLA_ORDER_SERVICE!',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// --- Konfiguracja Keycloak Connect dla order-service ---
const keycloakConfigOrderService = {
    realm: process.env.KEYCLOAK_REALM || 'sklep-realm',
    "auth-server-url": process.env.KEYCLOAK_AUTH_SERVER_URL || 'http://keycloak:8080/',
    "ssl-required": "external",
    resource: process.env.KEYCLOAK_CLIENT_ID || 'sklep-order-service-client', // Client ID dla order-service
    "bearer-only": true,
};

const keycloakOrder = new Keycloak({ store: memoryStore }, keycloakConfigOrderService);

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(keycloakOrder.middleware({
    logout: '/logout',
    admin: '/'
}));

// --- Inicjalizacja Bazy Danych ---
db.initializeDatabase().catch(err => {
    console.error("Order service: Failed to initialize database (order_service_db) on startup:", err);
    process.exit(1);
});

// --- Endpointy API ---
app.get('/health', (req, res) => {
    console.log("Order service: /health endpoint called");
    res.status(200).json({ status: 'UP', message: 'Order service is healthy!' });
});

app.post('/orders', keycloakOrder.protect('realm:user'), async (req, res) => {
    console.log('Order service: POST /orders called (protected by realm:user role)');
    const userIdFromToken = req.kauth.grant.access_token.content.sub;
    console.log('Order request from Keycloak user ID:', userIdFromToken);

    const { productItems: requestedItems } = req.body;
    const userId = userIdFromToken;

    if (!requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
        return res.status(400).send('Missing productItems.');
    }
    for (const item of requestedItems) {
        if (!item.productId || item.quantity == null || 
            isNaN(parseInt(item.quantity)) || parseInt(item.quantity) <= 0) {
            return res.status(400).send('Invalid productItems structure. Each item must have productId and a positive quantity.');
        }
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const processedProductItems = [];
        let calculatedTotalAmount = 0;

        for (const requestedItem of requestedItems) {
            const targetUrl = `${PRODUCT_SERVICE_BASE_URL}/products/${requestedItem.productId}`;
            console.log(`Order Service: Calling Product Service for product ID ${requestedItem.productId} at URL: ${targetUrl}`);
            try {
                const productResponse = await axios.get(targetUrl);
                if (productResponse.status === 200 && productResponse.data) {
                    const productData = productResponse.data;
                    processedProductItems.push({
                        productId: productData.id,
                        quantity: parseInt(requestedItem.quantity),
                        priceAtPurchase: parseFloat(productData.price)
                    });
                    calculatedTotalAmount += parseFloat(productData.price) * parseInt(requestedItem.quantity);
                } else {
                    throw new Error(`Invalid response from product-service for product ID ${requestedItem.productId}. Status: ${productResponse.status}`);
                }
            } catch (error) {
                console.error(`Error fetching product ID ${requestedItem.productId} from ${targetUrl}:`, error.response ? JSON.stringify(error.response.data) : error.message);
                if (error.response && error.response.status === 404) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Product with ID ${requestedItem.productId} not found via product-service.` });
                }
                throw error; 
            }
        }

        const orderQuery = `
            INSERT INTO orders (user_id, total_amount, status) 
            VALUES ($1, $2, $3) RETURNING id, user_id, total_amount, status, created_at, updated_at;
        `;
        const orderResult = await client.query(orderQuery, [userId, calculatedTotalAmount.toFixed(2), 'Pending']);
        const newOrder = orderResult.rows[0];

        for (const item of processedProductItems) {
            const orderItemQuery = `
                INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(orderItemQuery, [newOrder.id, String(item.productId), item.quantity, item.priceAtPurchase.toFixed(2)]);
        }

        await client.query('COMMIT');
        const fullOrder = { ...newOrder, products: processedProductItems.map(p => ({productId: String(p.productId), quantity: p.quantity, priceAtPurchase: p.priceAtPurchase.toFixed(2)})) };
        res.status(201).json(fullOrder);

    } catch (err) {
        if (client && !res.headersSent) { 
             try { await client.query('ROLLBACK'); } catch (rbError) { console.error('Error rolling back transaction in outer catch', rbError); }
        }
        console.error('Error creating order (outer catch):', err.message, err.stack);
        if (!res.headersSent) {
             res.status(500).send('Server error while creating order.');
        }
    } finally {
        if (client) client.release();
    }
});

app.get('/orders/user/:userId', keycloakOrder.protect('realm:user'), async (req, res) => {
    const requestedUserIdParam = req.params.userId;
    const tokenUserId = req.kauth.grant.access_token.content.sub;
    const tokenUserRoles = req.kauth.grant.access_token.content.realm_access.roles || [];

    console.log(`Order service: GET /orders/user/${requestedUserIdParam} called by token user ${tokenUserId}`);

    if (tokenUserId !== requestedUserIdParam && !tokenUserRoles.includes('admin')) {
        return res.status(403).send('Forbidden: You can only view your own orders or you need admin privileges.');
    }

    try {
        const ordersQuery = `
            SELECT id, user_id, total_amount, status, created_at, updated_at 
            FROM orders WHERE user_id = $1 ORDER BY created_at DESC;
        `;
        const ordersResult = await db.query(ordersQuery, [requestedUserIdParam]);

        if (ordersResult.rows.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user.' });
        }

        const ordersWithItems = [];
        for (const order of ordersResult.rows) {
            const itemsQuery = `
                SELECT id, product_id, quantity, price_at_purchase 
                FROM order_items WHERE order_id = $1;
            `;
            const itemsResult = await db.query(itemsQuery, [order.id]);
            ordersWithItems.push({ ...order, products: itemsResult.rows.map(p => ({orderItemId: p.id, productId: String(p.product_id), quantity: p.quantity, priceAtPurchase: p.price_at_purchase.toFixed(2)})) });
        }
        res.json(ordersWithItems);
    } catch (err) {
        console.error('Error fetching user orders:', err.message, err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/orders/:orderId', keycloakOrder.protect('realm:user'), async (req, res) => {
    const orderIdParam = parseInt(req.params.orderId);
    const tokenUserId = req.kauth.grant.access_token.content.sub;
    const tokenUserRoles = req.kauth.grant.access_token.content.realm_access.roles || [];

    console.log(`Order service: GET /orders/${orderIdParam} called by token user ${tokenUserId}`);

    if (isNaN(orderIdParam)) return res.status(400).send('Invalid order ID.');
    
    try {
        const orderQuery = `SELECT * FROM orders WHERE id = $1;`;
        const orderResult = await db.query(orderQuery, [orderIdParam]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        const order = orderResult.rows[0];

        if (order.user_id !== tokenUserId && !tokenUserRoles.includes('admin')) {
            return res.status(403).send('Forbidden: You can only view your own orders or you need admin privileges.');
        }
        
        const itemsQuery = `
            SELECT id, product_id, quantity, price_at_purchase 
            FROM order_items WHERE order_id = $1;
        `;
        const itemsResult = await db.query(itemsQuery, [order.id]);
        res.json({ ...order, products: itemsResult.rows.map(p => ({orderItemId: p.id, productId: String(p.product_id), quantity: p.quantity, priceAtPurchase: p.price_at_purchase.toFixed(2)})) });
    } catch (err) {
        console.error('Error fetching order details:', err.message, err.stack);
        res.status(500).send('Server error');
    }
});

app.put('/orders/:orderId/status', keycloakOrder.protect('realm:admin'), async (req, res) => {
    console.log(`Order service: PUT /orders/${req.params.orderId}/status called (protected by realm:admin role)`);
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) return res.status(400).send('Invalid order ID.');
    const { status } = req.body;
    if (!status) return res.status(400).send('Missing status.');

    try {
        const updateQuery = `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`;
        const { rows } = await db.query(updateQuery, [status, orderId]);
        if (rows.length > 0) {
            const updatedOrder = rows[0];
            const itemsQuery = `SELECT id, product_id, quantity, price_at_purchase FROM order_items WHERE order_id = $1;`;
            const itemsResult = await db.query(itemsQuery, [updatedOrder.id]);
            res.json({ ...updatedOrder, products: itemsResult.rows.map(p => ({orderItemId: p.id, productId: String(p.product_id), quantity: p.quantity, priceAtPurchase: p.price_at_purchase.toFixed(2)})) });
        } else {
            res.status(404).send('Order not found.');
        }
    } catch (err) {
        console.error('Error updating order status:', err.message, err.stack);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Order service listening on port ${port}. Keycloak integration active.`);
    console.log(`Keycloak config for order-service: realm='${keycloakConfigOrderService.realm}', auth-server-url='${keycloakConfigOrderService['auth-server-url']}', client-id='${keycloakConfigOrderService.resource}'`);
});

const gracefulShutdown = async () => {
    console.log('Shutting down order_service gracefully...');
    try {
        if (db.pool) {
            await db.pool.end();
            console.log('PostgreSQL pool (order_service_db) has been closed.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error during pool shutdown (order_service_db)', error.stack);
        process.exit(1);
    }
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
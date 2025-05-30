const express = require('express');
const db = require('./db'); // Importujemy nasz moduł db.js
const cors = require('cors'); // <<< 1. Importuj cors
const app = express();
const port = process.env.PORT || 3002;

app.use(cors()); // <<< 2. Użyj cors
app.use(express.json());

// Inicjalizacja bazy danych przy starcie aplikacji
db.initializeDatabase().catch(err => {
    console.error("Failed to initialize database (order_service_db) on startup:", err);
    process.exit(1);
});

// --- Endpointy dla Zamówień z użyciem PostgreSQL ---

// POST /orders - stwórz nowe zamówienie
app.post('/orders', async (req, res) => {
    const { userId, productItems } = req.body; // productItems: [{ productId: "prod123", quantity: 1, priceAtPurchase: 99.99 }, ...]

    if (!userId || !productItems || !Array.isArray(productItems) || productItems.length === 0) {
        return res.status(400).send('Missing userId or productItems.');
    }

    // Walidacja productItems
    for (const item of productItems) {
        if (!item.productId || item.quantity == null || item.priceAtPurchase == null || 
            isNaN(parseInt(item.quantity)) || parseInt(item.quantity) <= 0 ||
            isNaN(parseFloat(item.priceAtPurchase)) || parseFloat(item.priceAtPurchase) < 0) {
            return res.status(400).send('Invalid productItems structure or values. Each item must have productId, quantity, and priceAtPurchase.');
        }
    }

    // Obliczenie całkowitej kwoty zamówienia
    const totalAmount = productItems.reduce((sum, item) => sum + (parseFloat(item.priceAtPurchase) * parseInt(item.quantity)), 0);

    const client = await db.pool.connect(); // Pobieramy klienta z puli dla transakcji
    try {
        await client.query('BEGIN'); // Rozpoczęcie transakcji

        // 1. Wstawienie do tabeli 'orders'
        const orderQuery = `
            INSERT INTO orders (user_id, total_amount, status) 
            VALUES ($1, $2, $3) RETURNING id, created_at, status, total_amount, user_id;
        `;
        const orderResult = await client.query(orderQuery, [userId, totalAmount.toFixed(2), 'Pending']);
        const newOrder = orderResult.rows[0];

        // 2. Wstawienie do tabeli 'order_items' dla każdej pozycji
        for (const item of productItems) {
            const orderItemQuery = `
                INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(orderItemQuery, [newOrder.id, item.productId, parseInt(item.quantity), parseFloat(item.priceAtPurchase).toFixed(2)]);
        }

        await client.query('COMMIT'); // Zatwierdzenie transakcji

        // Pobranie pełnych danych zamówienia do odpowiedzi (opcjonalne, ale dobre dla klienta)
        const fullOrder = {
            ...newOrder,
            products: productItems.map(pi => ({ // Używamy productItems z requestu, bo mamy tam wszystkie dane
                productId: pi.productId,
                quantity: parseInt(pi.quantity),
                priceAtPurchase: parseFloat(pi.priceAtPurchase).toFixed(2)
            }))
        };
        res.status(201).json(fullOrder);

    } catch (err) {
        await client.query('ROLLBACK'); // Wycofanie transakcji w przypadku błędu
        console.error('Error creating order:', err.message, err.stack);
        res.status(500).send('Server error while creating order.');
    } finally {
        client.release(); // Zwolnienie klienta z powrotem do puli
    }
});

// GET /orders/user/:userId - pobierz zamówienia danego użytkownika (z pozycjami)
app.get('/orders/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Pobieranie zamówień
        const ordersQuery = `
            SELECT id, user_id, total_amount, status, created_at, updated_at 
            FROM orders WHERE user_id = $1 ORDER BY created_at DESC;
        `;
        const ordersResult = await db.query(ordersQuery, [userId]);

        if (ordersResult.rows.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user.' });
        }

        const ordersWithItems = [];
        for (const order of ordersResult.rows) {
            const itemsQuery = `
                SELECT product_id, quantity, price_at_purchase 
                FROM order_items WHERE order_id = $1;
            `;
            const itemsResult = await db.query(itemsQuery, [order.id]);
            ordersWithItems.push({ ...order, products: itemsResult.rows });
        }
        res.json(ordersWithItems);
    } catch (err) {
        console.error('Error fetching user orders:', err.message);
        res.status(500).send('Server error');
    }
});

// GET /orders/:orderId - pobierz szczegóły zamówienia (z pozycjami)
app.get('/orders/:orderId', async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).send('Invalid order ID.');
    }
    try {
        const orderQuery = `
            SELECT id, user_id, total_amount, status, created_at, updated_at 
            FROM orders WHERE id = $1;
        `;
        const orderResult = await db.query(orderQuery, [orderId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        const order = orderResult.rows[0];

        const itemsQuery = `
            SELECT product_id, quantity, price_at_purchase 
            FROM order_items WHERE order_id = $1;
        `;
        const itemsResult = await db.query(itemsQuery, [order.id]);
        
        res.json({ ...order, products: itemsResult.rows });
    } catch (err) {
        console.error('Error fetching order details:', err.message);
        res.status(500).send('Server error');
    }
});

// PUT /orders/:orderId/status - aktualizacja statusu zamówienia
app.put('/orders/:orderId/status', async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
        return res.status(400).send('Invalid order ID.');
    }
    const { status } = req.body;
    if (!status) {
        return res.status(400).send('Missing status.');
    }
    // Można dodać walidację dozwolonych statusów
    // const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    // if (!allowedStatuses.includes(status)) {
    // return res.status(400).send('Invalid status value.');
    // }

    try {
        const updateQuery = `
            UPDATE orders SET status = $1 WHERE id = $2 RETURNING *;
        `;
        const { rows } = await db.query(updateQuery, [status, orderId]);

        if (rows.length > 0) {
            // Jeśli chcemy zwrócić zamówienie z pozycjami:
            const updatedOrder = rows[0];
            const itemsQuery = `SELECT product_id, quantity, price_at_purchase FROM order_items WHERE order_id = $1;`;
            const itemsResult = await db.query(itemsQuery, [updatedOrder.id]);
            res.json({ ...updatedOrder, products: itemsResult.rows });
        } else {
            res.status(404).send('Order not found.');
        }
    } catch (err) {
        console.error('Error updating order status:', err.message);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Order service (DB connected) listening on port ${port}`);
});

// Obsługa poprawnego zamykania puli połączeń
const gracefulShutdown = async () => {
    console.log('Shutting down order_service gracefully...');
    try {
        await db.pool.end();
        console.log('PostgreSQL pool (order_service_db) has been closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during pool shutdown (order_service_db)', error.stack);
        process.exit(1);
    }
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
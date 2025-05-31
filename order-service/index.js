// order-service/index.js
const express = require('express');
const db = require('./db'); // Zakładamy, że db.js jest w tym samym katalogu
const axios = require('axios');
const app = express();

// Odczyt portu z zmiennej środowiskowej lub domyślny 3002
const port = process.env.PORT || 3002;

// Odczyt bazowego URL product-service z zmiennej środowiskowej
// lub domyślny dla lokalnego developmentu bez Dockera
const PRODUCT_SERVICE_BASE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';

app.use(express.json()); // Middleware do parsowania ciała żądań JSON

// Inicjalizacja bazy danych (tworzenie tabel, jeśli nie istnieją) przy starcie aplikacji
db.initializeDatabase().catch(err => {
    console.error("Failed to initialize database (order_service_db) on startup:", err);
    process.exit(1); // Zakończ aplikację, jeśli inicjalizacja bazy się nie powiedzie
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'Order service is healthy' });
});

// POST /orders - tworzenie nowego zamówienia
app.post('/orders', async (req, res) => {
    console.log('Attempting to create order. PRODUCT_SERVICE_BASE_URL currently set to:', PRODUCT_SERVICE_BASE_URL);
    const { userId, productItems: requestedItems } = req.body;

    if (!userId || !requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
        return res.status(400).send('Missing userId or productItems.');
    }

    for (const item of requestedItems) {
        if (!item.productId || item.quantity == null || 
            isNaN(parseInt(item.quantity)) || parseInt(item.quantity) <= 0) {
            return res.status(400).send('Invalid productItems structure. Each item must have productId and a positive quantity.');
        }
    }

    const client = await db.pool.connect(); // Pobieramy klienta z puli dla transakcji
    try {
        await client.query('BEGIN'); // Rozpoczęcie transakcji

        const processedProductItems = [];
        let calculatedTotalAmount = 0;

        for (const requestedItem of requestedItems) {
            // Poprawna konstrukcja URL do endpointu produktu w product-service
            const targetUrl = `${PRODUCT_SERVICE_BASE_URL}/products/${requestedItem.productId}`;
            console.log(`Order Service: Calling Product Service for product ID ${requestedItem.productId} at URL: ${targetUrl}`);
            
            try {
                const productResponse = await axios.get(targetUrl);
                
                if (productResponse.status === 200 && productResponse.data) {
                    const productData = productResponse.data;
                    processedProductItems.push({
                        productId: productData.id, // Używamy ID z odpowiedzi dla spójności
                        quantity: parseInt(requestedItem.quantity),
                        priceAtPurchase: parseFloat(productData.price) // Używamy ceny z product-service
                    });
                    calculatedTotalAmount += parseFloat(productData.price) * parseInt(requestedItem.quantity);
                } else {
                    // Ten blok może nie być osiągnięty, bo axios rzuca błędy dla statusów poza 2xx
                    throw new Error(`Invalid response from product-service for product ID ${requestedItem.productId}. Status: ${productResponse.status}`);
                }
            } catch (error) {
                console.error(`Error fetching product ID ${requestedItem.productId} from ${targetUrl}:`, error.response ? JSON.stringify(error.response.data) : error.message);
                if (error.response && error.response.status === 404) {
                    await client.query('ROLLBACK'); // Wycofaj transakcję
                    return res.status(400).json({ message: `Product with ID ${requestedItem.productId} not found via product-service.` });
                }
                throw error; // Rzuć błąd dalej, aby transakcja została wycofana w głównym bloku catch
            }
        }

        // Zapis zamówienia do tabeli 'orders'
        const orderQuery = `
            INSERT INTO orders (user_id, total_amount, status) 
            VALUES ($1, $2, $3) RETURNING id, user_id, total_amount, status, created_at, updated_at;
        `;
        const orderResult = await client.query(orderQuery, [userId, calculatedTotalAmount.toFixed(2), 'Pending']);
        const newOrder = orderResult.rows[0];

        // Zapis pozycji zamówienia do tabeli 'order_items'
        for (const item of processedProductItems) {
            const orderItemQuery = `
                INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(orderItemQuery, [newOrder.id, String(item.productId), item.quantity, item.priceAtPurchase.toFixed(2)]);
        }

        await client.query('COMMIT'); // Zatwierdzenie transakcji

        // Przygotowanie odpowiedzi z pełnymi danymi zamówienia
        const fullOrder = {
            ...newOrder,
            products: processedProductItems 
        };
        res.status(201).json(fullOrder);

    } catch (err) {
        // Upewniamy się, że rollback jest wywoływany tylko jeśli transakcja była aktywna i odpowiedź nie została jeszcze wysłana
        if (client && !res.headersSent) { 
             try { await client.query('ROLLBACK'); } catch (rbError) { console.error('Error rolling back transaction in outer catch', rbError); }
        }
        console.error('Error creating order (outer catch):', err.message, err.stack);
        if (!res.headersSent) { // Wysyłamy błąd 500 tylko jeśli wcześniej nie wysłano innej odpowiedzi (np. 400)
             res.status(500).send('Server error while creating order.');
        }
    } finally {
        if (client) {
            client.release(); // Zawsze zwalniamy klienta z powrotem do puli
        }
    }
});

// GET /orders/user/:userId - pobierz zamówienia danego użytkownika (z pozycjami)
app.get('/orders/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
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
    // Można dodać walidację dozwolonych statusów:
    // const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Completed'];
    // if (!allowedStatuses.includes(status)) {
    //    return res.status(400).send('Invalid status value.');
    // }

    try {
        const updateQuery = `
            UPDATE orders SET status = $1 WHERE id = $2 RETURNING *;
        `;
        const { rows } = await db.query(updateQuery, [status, orderId]);

        if (rows.length > 0) {
            const updatedOrder = rows[0];
            // Opcjonalnie: dołącz pozycje do odpowiedzi, tak jak w GET /orders/:orderId
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
    console.log(`Order service (DB connected, inter-service comms) listening on port ${port}`);
});

// Obsługa poprawnego zamykania puli połączeń przy zamykaniu aplikacji
const gracefulShutdown = async () => {
    console.log('Shutting down order_service gracefully...');
    try {
        await db.pool.end(); // Zamyka wszystkie połączenia w puli
        console.log('PostgreSQL pool (order_service_db) has been closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during pool shutdown (order_service_db)', error.stack);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown); // sygnał z `kill`
process.on('SIGINT', gracefulShutdown);  // sygnał z Ctrl+C
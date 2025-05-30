const express = require('express');
const app = express();
const port = process.env.PORT || 3002; // Inny port niż product-service

app.use(express.json()); // Middleware do parsowania JSON

// Przykładowa tablica zamówień (na razie w pamięci)
// Struktura zamówienia: { id: 1, userId: 101, products: [{ productId: 1, quantity: 2, priceAtPurchase: 4500 }, { productId: 2, quantity: 1, priceAtPurchase: 350 }], totalAmount: 9350, status: 'Pending' }
let orders = [];
let nextOrderId = 1;

// --- Proste Endpointy dla Zamówień ---

// POST /orders - stwórz nowe zamówienie
app.post('/orders', (req, res) => {
    const { userId, productItems } = req.body; // productItems to tablica np. [{ productId: 1, quantity: 1 }, ...]

    if (!userId || !productItems || !Array.isArray(productItems) || productItems.length === 0) {
        return res.status(400).send('Missing userId or productItems, or productItems is not a valid array.');
    }

    // W przyszłości:
    // 1. Weryfikacja istnienia userId (jeśli masz user-service).
    // 2. Pobranie aktualnych cen produktów z product-service i walidacja dostępności.
    // 3. Obliczenie totalAmount na podstawie aktualnych cen.
    // Tutaj, dla uproszczenia, zakładamy, że ceny są przekazywane lub pomijamy ten krok.
    let calculatedTotalAmount = 0;
    const processedProductItems = productItems.map(item => {
        // Symulacja pobrania ceny - w realnym scenariuszu tu byłby call do product-service
        const mockPrice = item.productId === 1 ? 4500 : (item.productId === 2 ? 350 : 100); // Przykładowe ceny
        calculatedTotalAmount += mockPrice * item.quantity;
        return {
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: mockPrice // Zapisujemy cenę w momencie zakupu
        };
    });

    const newOrder = {
        id: nextOrderId++,
        userId,
        products: processedProductItems,
        totalAmount: calculatedTotalAmount,
        status: 'Pending', // Domyślny status
        createdAt: new Date().toISOString()
    };

    orders.push(newOrder);
    console.log('New order created:', newOrder);
    res.status(201).json(newOrder);
});

// GET /orders/user/:userId - pobierz zamówienia danego użytkownika
app.get('/orders/user/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userOrders = orders.filter(order => order.userId === userId);

    if (userOrders.length > 0) {
        res.json(userOrders);
    } else {
        res.status(404).send('No orders found for this user or user does not exist.');
    }
});

// GET /orders/:orderId - pobierz szczegóły zamówienia
app.get('/orders/:orderId', (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const order = orders.find(o => o.id === orderId);

    if (order) {
        res.json(order);
    } else {
        res.status(404).send('Order not found.');
    }
});

// (Opcjonalnie) PUT /orders/:orderId/status - aktualizacja statusu zamówienia (np. przez admina)
app.put('/orders/:orderId/status', (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { status } = req.body;

    if (!status) {
        return res.status(400).send('Missing status.');
    }

    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
        orders[orderIndex].status = status;
        console.log(`Order ${orderId} status updated to ${status}`);
        res.json(orders[orderIndex]);
    } else {
        res.status(404).send('Order not found.');
    }
});


app.listen(port, () => {
    console.log(`Order service listening on port ${port}`);
});
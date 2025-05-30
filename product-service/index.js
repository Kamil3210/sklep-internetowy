const express = require('express');
const app = express();
const port = process.env.PORT || 3001; // Port dla usługi produktów

app.use(express.json()); // Middleware do parsowania JSON

// Przykładowa tablica produktów (na razie w pamięci)
let products = [
    { id: 1, name: 'Laptop Pro', price: 4500, category: 'Electronics' },
    { id: 2, name: 'Klawiatura Mechaniczna', price: 350, category: 'Accessories' },
    { id: 3, name: 'Mysz Gamingowa', price: 200, category: 'Accessories' }
];
let nextProductId = 4;

// --- Proste Endpointy CRUD dla Produktów ---

// GET /products - pobierz listę wszystkich produktów
app.get('/products', (req, res) => {
    res.json(products);
});

// GET /products/:id - pobierz produkt o danym ID
app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    if (product) {
        res.json(product);
    } else {
        res.status(404).send('Product not found');
    }
});

// POST /products - dodaj nowy produkt
app.post('/products', (req, res) => {
    const { name, price, category } = req.body;
    if (!name || price == null || !category) {
        return res.status(400).send('Missing name, price, or category');
    }
    const newProduct = {
        id: nextProductId++,
        name,
        price,
        category
    };
    products.push(newProduct);
    res.status(201).json(newProduct);
});

// PUT /products/:id - aktualizuj produkt (prosta implementacja - zastępuje cały obiekt)
app.put('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex !== -1) {
        const { name, price, category } = req.body;
        if (!name || price == null || !category) {
            return res.status(400).send('Missing name, price, or category for update');
        }
        products[productIndex] = { ...products[productIndex], name, price, category };
        res.json(products[productIndex]);
    } else {
        res.status(404).send('Product not found');
    }
});

// DELETE /products/:id - usuń produkt
app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex !== -1) {
        const deletedProduct = products.splice(productIndex, 1);
        res.json(deletedProduct[0]);
    } else {
        res.status(404).send('Product not found');
    }
});


app.listen(port, () => {
    console.log(`Product service listening on port ${port}`);
});
const express = require('express');
const db = require('./db'); // Importujemy nasz moduł db.js
const cors = require('cors'); // <<< 1. Importuj cors
const app = express();
const port = process.env.PORT || 3001;


app.use(cors());
app.use(express.json());

// Inicjalizacja bazy danych (stworzenie tabeli jeśli nie istnieje) przy starcie aplikacji
db.initializeDatabase().catch(err => {
    console.error("Failed to initialize database on startup:", err);
    process.exit(1); // Zakończ aplikację jeśli inicjalizacja bazy danych się nie powiedzie
});


// --- Endpointy CRUD dla Produktów z użyciem PostgreSQL ---

// GET /products - pobierz listę wszystkich produktów
app.get('/products', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// GET /products/:id - pobierz produkt o danym ID
app.get('/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
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
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// POST /products - dodaj nowy produkt
app.post('/products', async (req, res) => {
    const { name, price, category } = req.body;
    if (!name || price == null || category == null) { // Pozwalamy na pustą kategorię, ale musi być podana
        return res.status(400).send('Missing name, price, or category');
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        return res.status(400).send('Invalid price value');
    }

    try {
        const { rows } = await db.query(
            'INSERT INTO products (name, price, category) VALUES ($1, $2, $3) RETURNING *',
            [name, parseFloat(price), category]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /products/:id - aktualizuj produkt
app.put('/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
        return res.status(400).send('Invalid product ID');
    }
    const { name, price, category } = req.body;

    // Prosta walidacja - można ją rozbudować
    if (name === undefined && price === undefined && category === undefined) {
        return res.status(400).send('No fields provided for update.');
    }
    if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
        return res.status(400).send('Invalid price value');
    }

    try {
        // Dynamiczne budowanie zapytania, aby aktualizować tylko podane pola
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            fields.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (price !== undefined) {
            fields.push(`price = $${paramCount++}`);
            values.push(parseFloat(price));
        }
        if (category !== undefined) {
            fields.push(`category = $${paramCount++}`);
            values.push(category);
        }
        
        // Dodajemy updated_at, które będzie automatycznie zaktualizowane przez trigger, ale możemy też dodać ręcznie
        // fields.push(`updated_at = CURRENT_TIMESTAMP`);

        if (fields.length === 0) {
             return res.status(400).send("No updatable fields provided.");
        }

        values.push(productId); // Ostatni parametr to ID produktu
        const queryText = `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        
        const { rows } = await db.query(queryText, values);

        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).send('Product not found or no changes made');
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// DELETE /products/:id - usuń produkt
app.delete('/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id);
     if (isNaN(productId)) {
        return res.status(400).send('Invalid product ID');
    }
    try {
        const { rows } = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
        if (rows.length > 0) {
            res.json({ message: 'Product deleted successfully', product: rows[0] });
        } else {
            res.status(404).send('Product not found');
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'Product service is healthy' });
});

app.listen(port, () => {
    console.log(`Product service listening on port ${port}`);
});

// Obsługa poprawnego zamykania puli połączeń przy zamykaniu aplikacji
const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    try {
        await db.pool.end(); // Zamyka wszystkie połączenia w puli
        console.log('PostgreSQL pool has been closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during pool shutdown', error.stack);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown); // sygnał z `kill`
process.on('SIGINT', gracefulShutdown);  // sygnał z Ctrl+C
// sklep-internetowy/order-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME, // Powinno być 'order_service_db' z .env przez docker-compose
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});

pool.on('connect', () => {
    console.log(`Order service connected to PostgreSQL database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client (order_service_db)', err);
    process.exit(-1);
});

const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Order service executed query', { text: text.substring(0,100), duration, rows: res.rowCount });
    return res;
};

const initializeDatabase = async () => {
    const createOrdersTableQuery = `
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL, 
            total_amount NUMERIC(10, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createOrderItemsTableQuery = `
        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id VARCHAR(255) NOT NULL, 
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            price_at_purchase NUMERIC(10, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createTriggerFunctionQuery = `
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `;

    const triggers = [
        { tableName: 'orders', triggerName: 'set_timestamp_orders_os' }, // Inna nazwa triggera
        { tableName: 'order_items', triggerName: 'set_timestamp_order_items_os' } // Inna nazwa triggera
    ];

    try {
        console.log('Order service: Initializing database schema for order_service_db...');
        await pool.query(createOrdersTableQuery);
        console.log('Order service: Table "orders" ensured to exist.');
        await pool.query(createOrderItemsTableQuery);
        console.log('Order service: Table "order_items" ensured to exist.');

        // Funkcja triggera jest globalna dla bazy (lub schematu), więc może już istnieć
        // jeśli product-service ją stworzył w tym samym schemacie/bazie.
        // Jeśli order_service_db jest całkowicie oddzielną bazą, to trzeba ją tu stworzyć.
        // Dla pewności tworzymy ją (CREATE OR REPLACE nie zaszkodzi).
        await pool.query(createTriggerFunctionQuery);
        console.log('Order service: Trigger function "trigger_set_timestamp" ensured to exist.');

        for (const t of triggers) {
            const dropExistingTriggerQuery = `DROP TRIGGER IF EXISTS ${t.triggerName} ON ${t.tableName};`;
            const createTriggerQuery = `
                CREATE TRIGGER ${t.triggerName}
                BEFORE UPDATE ON ${t.tableName}
                FOR EACH ROW
                EXECUTE PROCEDURE trigger_set_timestamp();
            `;
            await pool.query(dropExistingTriggerQuery);
            await pool.query(createTriggerQuery);
            console.log(`Order service: Trigger "${t.triggerName}" ensured for "${t.tableName}" table updates.`);
        }
        console.log('Order service: Database schema initialization for order_service_db complete.');
    } catch (err) {
        console.error('Order service: Error initializing database schema for order_service_db:', err.stack);
    }
};

module.exports = {
    query,
    initializeDatabase,
    pool
};
// sklep-internetowy/product-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});

pool.on('connect', () => {
    console.log(`Product service connected to PostgreSQL database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client (product_service_db)', err);
    process.exit(-1);
});

const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Product service executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
};

const initializeDatabase = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price NUMERIC(10, 2) NOT NULL,
            category VARCHAR(100),
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
    const dropExistingTriggerQuery = `
        DROP TRIGGER IF EXISTS set_timestamp_products ON products;
    `;
    const createTriggerQuery = `
        CREATE TRIGGER set_timestamp_products
        BEFORE UPDATE ON products
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    `;

    try {
        await pool.query(createTableQuery);
        console.log('Product service: Table "products" ensured to exist.');
        await pool.query(createTriggerFunctionQuery);
        console.log('Product service: Trigger function "trigger_set_timestamp" ensured to exist.');
        await pool.query(dropExistingTriggerQuery);
        await pool.query(createTriggerQuery);
        console.log('Product service: Trigger "set_timestamp_products" ensured for "products" table updates.');
    } catch (err) {
        console.error('Product service: Error initializing database schema:', err.stack);
    }
};

module.exports = {
    query,
    initializeDatabase,
    pool
};
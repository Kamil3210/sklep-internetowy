const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"), // Użyj portu z env, domyślnie 5432
});

pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database!');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Funkcja do wykonywania zapytań
// Przykład użycia: const { rows } = await query('SELECT * FROM users');
const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
};

// Funkcja do inicjalizacji tabeli (jeśli jeszcze nie istnieje)
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
    // Prosty trigger do aktualizacji updated_at
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
        console.log('Table "products" ensured to exist.');
        await pool.query(createTriggerFunctionQuery);
        console.log('Trigger function "trigger_set_timestamp" ensured to exist.');
        await pool.query(dropExistingTriggerQuery); // Usuwamy stary trigger jeśli istnieje, aby uniknąć błędu
        await pool.query(createTriggerQuery);
        console.log('Trigger "set_timestamp_products" ensured for "products" table updates.');
    } catch (err) {
        console.error('Error initializing database schema:', err.stack);
        // Jeśli błąd jest krytyczny dla uruchomienia aplikacji, można tu rzucić wyjątek dalej
        // lub process.exit(1)
    }
};


module.exports = {
    query,
    initializeDatabase,
    pool // eksportujemy pool na wypadek gdybyśmy potrzebowali bezpośredniego dostępu np. do transakcji
};
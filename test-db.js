const mysql = require('mysql2/promise');

async function test() {
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'biblioteca_virtual'
        });
        console.log('Conexão com banco OK!');
        await conn.end();
    } catch (e) {
        console.error('Erro ao conectar:', e);
    }
}

test();
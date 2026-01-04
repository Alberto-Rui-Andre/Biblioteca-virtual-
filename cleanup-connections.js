const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
});

connection.connect((err) => {
    if (err) throw err;
    
    console.log('Limpando conexões...');
    
    connection.query('SHOW PROCESSLIST', (err, results) => {
        if (err) throw err;
        
        results.forEach(process => {
            if (process.Time > 60) { // Conexões com mais de 60 segundos
                connection.query(`KILL ${process.Id}`, (killErr) => {
                    if (!killErr) {
                        console.log(`Conexão ${process.Id} finalizada`);
                    }
                });
            }
        });
        
        connection.end();
    });
});
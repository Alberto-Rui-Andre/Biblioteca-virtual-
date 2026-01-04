const mysql = require("mysql");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",        // seu usuário MySQL
    password: "",        // sua senha do MySQL
    database: "biblioteca_virtual"  // <- alterado para o nome correto
});

connection.connect((err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados:", err);
        return;
    }
    console.log("Conectado ao banco de dados MySQL!");
});

module.exports = connection;


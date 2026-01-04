const connection = require("../database.js"); // caminho relativo correto

const Usuarios = {

buscarPorEmail: (email) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM usuarios WHERE email = ?";
        connection.query(sql, [email], (err, results) => {
            if (err) return reject(err);
            if (results.length === 0) return resolve(null);
            resolve(results[0]);
        });
    });
},

criarUsuario: (nome, numero_matricula, numero_agente, email, senha_hash, tipo, callback) => {
    const sql = "INSERT INTO usuarios (nome, numero_matricula, numero_agente, email, senha_hash, tipo) VALUES (?, ?, ?, ?, ?, ?)";
    connection.query(sql, [nome, numero_matricula, numero_agente, email, senha_hash, tipo], callback);
},

listarPorTipo: (tipo) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT id, nome, email, numero_matricula, numero_agente, tipo FROM usuarios WHERE tipo = ?";
        connection.query(sql, [tipo], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
},

listarTodos: () => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT id, nome, email, numero_matricula, numero_agente, tipo FROM usuarios";
        connection.query(sql, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

};

module.exports = Usuarios;

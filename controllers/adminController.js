const Usuarios = require("../models/usuariosModel");

// Listar usuários (tipo 'estudante')
async function listarUsuarios(req, res) {
try {
const usuarios = await Usuarios.listarPorTipo("estudante");
res.json(usuarios);
} catch (err) {
res.status(500).json({ error: err.message });
}
}

// Listar professores (tipo 'professor')
async function listarProfessores(req, res) {
try {
const professores = await Usuarios.listarPorTipo("professor");
res.json(professores);
} catch (err) {
res.status(500).json({ error: err.message });
}
}

module.exports = {
listarUsuarios,
listarProfessores
};
const express = require("express");
const router = express.Router();
const path = require("path");

// Middleware para verificar se é professor
function isProfessor(req, res, next) {
    if (req.session.user && req.session.user.tipo === 'professor') {
        next();
    } else {
        res.status(403).send("Acesso negado");
    }
}

// Painel do professor
router.get("/", isProfessor, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/professor.html"));
});

module.exports = router;
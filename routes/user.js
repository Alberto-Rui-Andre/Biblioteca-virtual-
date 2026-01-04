const express = require("express");
const router = express.Router();
const path = require("path");
const { verificarLogin } = require("../middlewares/auth");

// Exemplo de rota para baixar livro
router.get("/baixar/:id", verificarLogin, (req, res) => {
    const idLivro = req.params.id;

    // Aqui você deve buscar o arquivo correspondente ao livro
    // Exemplo: arquivos em /public/livros
    const arquivo = path.join(__dirname, "../public/livros", `${idLivro}.pdf`);

    res.download(arquivo, (err) => {
        if (err) res.send("Erro ao baixar o livro: " + err);
    });
});

module.exports = router;


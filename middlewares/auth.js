// middlewares/auth.js
function verificarLogin(req, res, next) {
    if (req.session.user) {
        next(); // usuário está logado, continua
    } else {
        // REDIRECIONA PARA A PÁGINA INICIAL (index.html)
        res.redirect("/");
    }
}

module.exports = { verificarLogin };

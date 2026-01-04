// middlewares/authMiddleware.js
function userAuth(req, res, next) {
    if (req.session.user && req.session.user.tipo === "estudante") {
        next();
    } else {
        // REDIRECIONA PARA A PÁGINA INICIAL (index.html)
        res.redirect("/");
    }
}

module.exports = { userAuth };

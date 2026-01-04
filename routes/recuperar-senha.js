const express = require("express");
const router = express.Router();
const path = require("path");
const crypto = require("crypto");
const { simpleHash } = require("../utils/hash");

// Middleware para verificar se usuário está logado (exceto para recuperação)
function isLoggedIn(req, res, next) {
    if (req.session.user) {
        return res.redirect('/user');
    }
    next();
}

router.use((req, res, next) => {
    console.log('Recuperação de senha - Rota acessada:', req.path);
    console.log('Método:', req.method);
    console.log('Body:', req.body);
    next();
});

// Página inicial de recuperação
router.get("/", isLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/recuperar-senha.html"));
});

// Solicitar recuperação de senha
router.post("/solicitar", isLoggedIn, async (req, res) => {
    try {
        const { email } = req.body;
        
        // Verificar se o email existe
        const [usuarios] = await req.db.execute(
            "SELECT id, nome, email, tipo FROM usuarios WHERE email = ?",
            [email]
        );
        
        if (usuarios.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: "Email não encontrado no sistema" 
            });
        }
        
        const usuario = usuarios[0];
        
        // Gerar token de recuperação
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiraEm = new Date(Date.now() + 3600000); // 1 hora
        
        // Remover tokens antigos do usuário
        await req.db.execute(
            "DELETE FROM recuperacao_senha WHERE id_usuario = ?",
            [usuario.id]
        );
        
        // Salvar token no banco
        await req.db.execute(
            "INSERT INTO recuperacao_senha (id_usuario, token_hash, expira_em) VALUES (?, ?, ?)",
            [usuario.id, tokenHash, expiraEm]
        );
        
        // Em ambiente de desenvolvimento, retornar o link diretamente
        const linkRecuperacao = `${req.protocol}://${req.get("host")}/recuperar-senha/redefinir?token=${token}&id=${usuario.id}`;
        
        // Aqui você implementaria o envio de email real
        console.log("=== LINK DE RECUPERAÇÃO (Desenvolvimento) ===");
        console.log(`Para: ${usuario.email}`);
        console.log(`Link: ${linkRecuperacao}`);
        console.log(`Token: ${token}`);
        console.log(`ID Usuário: ${usuario.id}`);
        console.log("============================================");
        
        res.json({ 
            success: true,
            message: "Instruções de recuperação enviadas para seu email",
            // Em desenvolvimento, retorna o link para facilitar testes
            link: process.env.NODE_ENV === "production" ? undefined : linkRecuperacao
        });
        
    } catch (error) {
        console.error("Erro na recuperação de senha:", error);
        res.status(500).json({ 
            success: false,
            error: "Erro interno do servidor. Tente novamente mais tarde." 
        });
    }
});

// Página de redefinição
router.get("/redefinir", isLoggedIn, (req, res) => {
    const { token, id } = req.query;
    
    if (!token || !id) {
        return res.redirect('/recuperar-senha?erro=token-invalido');
    }
    
    res.sendFile(path.join(__dirname, "../public/redefinir-senha.html"));
});

// Verificar token
router.get("/verificar-token", isLoggedIn, async (req, res) => {
    try {
        const { token, id } = req.query;
        
        if (!token || !id) {
            return res.status(400).json({ 
                success: false,
                error: "Token e ID são obrigatórios" 
            });
        }
        
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        
        // Verificar token no banco
        const [tokens] = await req.db.execute(
            `SELECT r.*, u.email 
             FROM recuperacao_senha r
             JOIN usuarios u ON r.id_usuario = u.id
             WHERE r.id_usuario = ? AND r.token_hash = ? AND r.usado = 0 AND r.expira_em > NOW()`,
            [id, tokenHash]
        );
        
        if (tokens.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: "Link inválido ou expirado. Solicite um novo link de recuperação." 
            });
        }
        
        res.json({ 
            success: true,
            message: "Token válido",
            email: tokens[0].email
        });
        
    } catch (error) {
        console.error("Erro ao verificar token:", error);
        res.status(500).json({ 
            success: false,
            error: "Erro interno do servidor" 
        });
    }
});

// Redefinir senha
router.post("/redefinir", isLoggedIn, async (req, res) => {
    try {
        const { token, id_usuario, senha, confirmar_senha } = req.body;
        
        // Validações
        if (!token || !id_usuario || !senha || !confirmar_senha) {
            return res.status(400).json({ 
                success: false,
                error: "Todos os campos são obrigatórios" 
            });
        }
        
        if (senha !== confirmar_senha) {
            return res.status(400).json({ 
                success: false,
                error: "As senhas não coincidem" 
            });
        }
        
        if (senha.length < 6) {
            return res.status(400).json({ 
                success: false,
                error: "A senha deve ter pelo menos 6 caracteres" 
            });
        }
        
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        
        // Verificar token
        const [tokens] = await req.db.execute(
            `SELECT * FROM recuperacao_senha 
             WHERE id_usuario = ? AND token_hash = ? AND usado = 0 AND expira_em > NOW()`,
            [id_usuario, tokenHash]
        );
        
        if (tokens.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: "Link inválido ou expirado. Solicite um novo link de recuperação." 
            });
        }
        
        // Hash da nova senha
        const senhaHash = simpleHash(senha);
        
        // Atualizar senha do usuário
        await req.db.execute(
            "UPDATE usuarios SET senha_hash = ? WHERE id = ?",
            [senhaHash, id_usuario]
        );
        
        // Marcar token como usado
        await req.db.execute(
            "UPDATE recuperacao_senha SET usado = 1 WHERE id = ?",
            [tokens[0].id]
        );
        
        res.json({ 
            success: true,
            message: "Senha redefinida com sucesso! Você já pode fazer login com a nova senha." 
        });
        
    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ 
            success: false,
            error: "Erro interno do servidor" 
        });
    }
});

module.exports = router;
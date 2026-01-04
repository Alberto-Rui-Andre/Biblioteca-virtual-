const express = require("express");
const router = express.Router();
const path = require("path");
const { simpleHash, simpleCompare } = require("../utils/hash");

// **ROTA GET PARA PÁGINA DE LOGIN (ESTAVA FALTANDO)**
router.get("/login", (req, res) => {
    console.log('=== ACESSO PÁGINA LOGIN ===');
    
    if (req.session.user) {
        console.log('Usuário já logado, redirecionando:', req.session.user.email);
        
        // Redirecionar usuário logado para sua página apropriada
        let redirectUrl = '/user';
        switch (req.session.user.tipo) {
            case 'admin':
                redirectUrl = '/admin';
                break;
            case 'professor':
                redirectUrl = '/professor';
                break;
        }
        return res.redirect(redirectUrl);
    }
    
    res.sendFile(path.join(__dirname, "../public/login.html"));
});

// **ROTA GET PARA PÁGINA DE CADASTRO**
router.get("/cadastro", (req, res) => {
    console.log('=== ACESSO PÁGINA CADASTRO ===');
    
    // Se já estiver logado, redireciona para sua área
    if (req.session.user) {
        console.log('Usuário já logado, redirecionando:', req.session.user.email);
        
        let redirectUrl = '/user';
        switch (req.session.user.tipo) {
            case 'admin':
                redirectUrl = '/admin';
                break;
            case 'professor':
                redirectUrl = '/professor';
                break;
        }
        return res.redirect(redirectUrl);
    }
    
    res.sendFile(path.join(__dirname, "../public/cadastro.html"));
});

// **ROTA POST PARA LOGIN (JÁ EXISTIA)**
router.post("/login", async (req, res) => {
    const { email, senha } = req.body;

    console.log('=== TENTATIVA DE LOGIN ===');
    console.log('Email:', email);

    // Validação básica
    if (!email || !senha) {
        console.log('Campos obrigatórios faltando');
        return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    try {
        const [users] = await req.db.execute(
            "SELECT * FROM usuarios WHERE email = ?", 
            [email]
        );

        console.log('Usuários encontrados:', users.length);

        if (users.length === 0) {
            console.log('Nenhum usuário encontrado com este email');
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        const user = users[0];
        console.log('Usuário encontrado:', user.email, 'Tipo:', user.tipo);
        console.log('Hash no banco:', user.senha_hash);

        // Verificar senha
        const senhaCorreta = simpleCompare(senha, user.senha_hash);
        console.log('Senha correta?', senhaCorreta);

        if (!senhaCorreta) {
            console.log('Senha incorreta para:', user.email);
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        // Configurar sessão
        req.session.user = {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo
        };

        console.log('✅ Login bem-sucedido para:', user.email, 'Tipo:', user.tipo);

        // Redirecionar conforme o tipo de usuário
        let redirectUrl = '/user'; // padrão para estudantes/visitantes
        
        switch (user.tipo) {
            case 'admin':
                redirectUrl = '/admin';
                break;
            case 'professor':
                redirectUrl = '/professor';
                break;
            case 'estudante':
            case 'visitante':
                redirectUrl = '/user';
                break;
        }

        console.log('Redirecionando para:', redirectUrl);
        res.json({ success: true, redirect: redirectUrl });

    } catch (error) {
        console.error("❌ Erro no login:", error);
        res.status(500).json({ error: "Erro interno do servidor: " + error.message });
    }
});

// **ROTA POST PARA CADASTRO (JÁ EXISTIA)**
router.post("/cadastro", async (req, res) => {
    const { nome, email, senha, tipo, numero_matricula, numero_agente } = req.body;

    console.log('=== TENTATIVA DE CADASTRO ===');
    console.log('Dados:', { nome, email, tipo, numero_matricula });

    // Validação
    if (!nome || !email || !senha || !tipo) {
        console.log('Campos obrigatórios faltando');
        return res.status(400).json({ error: "Todos os campos obrigatórios devem ser preenchidos" });
    }

    // Validar tipo
    if (!['estudante', 'visitante'].includes(tipo)) {
        console.log('Tipo inválido:', tipo);
        return res.status(400).json({ error: "Tipo de usuário inválido" });
    }

    try {
        // Verificar se email já existe
        const [existing] = await req.db.execute(
            "SELECT id FROM usuarios WHERE email = ?", 
            [email]
        );

        if (existing.length > 0) {
            console.log('Email já cadastrado:', email);
            return res.status(400).json({ error: "Email já cadastrado" });
        }

        const senhaHash = simpleHash(senha);
        console.log('Hash da senha gerado:', senhaHash);

        // Inserir usuário
        await req.db.execute(
            "INSERT INTO usuarios (nome, email, senha_hash, tipo, numero_matricula, numero_agente) VALUES (?, ?, ?, ?, ?, ?)",
            [nome, email, senhaHash, tipo, numero_matricula || null, numero_agente || null]
        );

        console.log('✅ Cadastro realizado com sucesso para:', email);
        res.json({ success: true, message: "Cadastro realizado com sucesso! Você já pode fazer login." });

    } catch (error) {
        console.error("❌ Erro no cadastro:", error);
        res.status(500).json({ error: "Erro interno do servidor: " + error.message });
    }
});

// **ROTA DE LOGOUT (CORRIGIDA)**
router.get("/logout", (req, res) => {
    console.log('=== LOGOUT ===');
    console.log('Usuário deslogado:', req.session.user?.email);
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Erro ao fazer logout:', err);
        }
        // Redireciona para a página inicial (/)
        res.redirect("/");
    });
});

// **ROTA PARA VERIFICAR SESSÃO (PARA DEBUG)**
router.get("/session", (req, res) => {
    res.json({ 
        session: req.session,
        user: req.session.user 
    });
});

module.exports = router;
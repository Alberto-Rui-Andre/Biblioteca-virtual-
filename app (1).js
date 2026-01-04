const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql2/promise');
const os = require('os');

const app = express();

// Função para pegar o IP da máquina
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Configuração do banco de dados
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'biblioteca_virtual'
};

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Session configuration
app.use(session({
    secret: 'biblioteca-virtual-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Database middleware
app.use(async (req, res, next) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        req.db = connection;
        next();
    } catch (error) {
        console.error('Erro na conexão com o banco:', error);
        res.status(500).send('Erro de conexão com o banco de dados');
    }
});

// Middleware para verificar autenticação
const verificarAutenticacao = (tiposPermitidos = []) => {
    return (req, res, next) => {
        if (!req.session.user) {
            console.log('❌ Usuário não autenticado');
            return res.redirect('/');
        }

        if (tiposPermitidos.length === 0) {
            return next();
        }

        if (tiposPermitidos.includes(req.session.user.tipo)) {
            return next();
        }

        console.log(`❌ Acesso negado para tipo: ${req.session.user.tipo}`);

        let redirectUrl = '/user';
        switch (req.session.user.tipo) {
            case 'admin':
                redirectUrl = '/admin';
                break;
            case 'professor':
                redirectUrl = '/professor';
                break;
        }
        res.redirect(redirectUrl);
    };
};

// -----------------------
// ROTAS PÚBLICAS
// -----------------------

app.get("/", (req, res) => {
    console.log('=== ACESSO PÁGINA INICIAL ===');

    if (req.session.user) {
        console.log('Usuário já logado, redirecionando...');
        let redirectUrl = '/user';
        switch (req.session.user.tipo) {
            case 'admin': redirectUrl = '/admin'; break;
            case 'professor': redirectUrl = '/professor'; break;
        }
        return res.redirect(redirectUrl);
    }

    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        let redirectUrl = '/user';
        switch (req.session.user.tipo) {
            case 'admin': redirectUrl = '/admin'; break;
            case 'professor': redirectUrl = '/professor'; break;
        }
        return res.redirect(redirectUrl);
    }
    res.redirect('/auth/login');
});

app.get('/cadastro', (req, res) => {
    if (req.session.user) {
        let redirectUrl = '/user';
        switch (req.session.user.tipo) {
            case 'admin': redirectUrl = '/admin'; break;
            case 'professor': redirectUrl = '/professor'; break;
        }
        return res.redirect(redirectUrl);
    }
    res.redirect('/auth/cadastro');
});

// -----------------------
// ROTAS DO SISTEMA
// -----------------------
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/professor', require('./routes/professor'));
app.use('/api/livros', require('./routes/livros'));
app.use('/api/autores', require('./routes/autores'));

app.get('/user', verificarAutenticacao(['estudante', 'visitante']), (req, res) => {
    const userName = req.session.user.nome;
    const userType = req.session.user.tipo;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Biblioteca Virtual</title>
            <script>
                localStorage.setItem('userName', '${userName}');
                localStorage.setItem('userType', '${userType}');
                window.location.href = '/user.html';
            </script>
        </head>
        <body>
            <p>Redirecionando...</p>
        </body>
        </html>
    `);
});

app.get('/user.html', verificarAutenticacao(['estudante', 'visitante']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/user.html'));
});

app.get('/professor', verificarAutenticacao(['professor']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/professor.html'));
});

app.get('/admin', verificarAutenticacao(['admin']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/css/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/css/style.css'));
});


// Importar rotas de recuperação de senha
const recuperarSenhaRouter = require('./routes/recuperar-senha');

// ... outras configurações existentes ...

// Usar rota de recuperação de senha
app.use('/recuperar-senha', recuperarSenhaRouter);

// ... resto do seu código existente ...

// Info do usuário logado
app.get('/api/user-info', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    res.json(req.session.user);
});


app.post('/admin/redefinir-senha', async (req, res) => {
    try {
        const { email } = req.body;
        
        // 1. Buscar usuário pelo email
        // 2. Gerar nova senha (ex: "123456" ou aleatória)
        // 3. Atualizar no banco de dados
        // 4. Retornar sucesso
        
        res.json({ 
            success: true, 
            message: 'Senha redefinida com sucesso',
            novaSenha: '123456' // Ou senha gerada
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});



// Estatísticas gerais
app.get('/api/estatisticas-gerais', async (req, res) => {
    try {
        const db = req.db;
        const [totalLivros] = await db.execute("SELECT COUNT(*) as total FROM livros");
        const [totalAutores] = await db.execute("SELECT COUNT(*) as total FROM autores");
        const [totalCategorias] = await db.execute("SELECT COUNT(*) as total FROM categorias");
        const [totalProfessores] = await db.execute("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'professor'");

        res.json({
            totalLivros: totalLivros[0].total,
            totalAutores: totalAutores[0].total,
            totalCategorias: totalCategorias[0].total,
            totalProfessores: totalProfessores[0].total
        });
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Livros em destaque
app.get('/api/livros-destaque', async (req, res) => {
    try {
        const db = req.db;
        const query = `
            SELECT 
                l.*,
                a.nome as autor_nome,
                c.nome as categoria_nome,
                u.nome as professor_nome
            FROM livros l
            LEFT JOIN autores a ON l.id_autor = a.id
            LEFT JOIN categorias c ON l.id_categoria = c.id
            LEFT JOIN usuarios u ON l.id_professor = u.id
            ORDER BY l.criado_em DESC
            LIMIT 3
        `;
        const [livros] = await db.execute(query);
        res.json(livros);
    } catch (error) {
        console.error('Erro ao carregar livros destaque:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Fecha conexão
app.use((req, res, next) => {
    if (req.db) {
        req.db.end().catch(console.error);
    }
    next();
});

// Erros
app.use((err, req, res, next) => {
    console.error('Erro:', err);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 10MB' });
    }
    if (err.message.includes('apenas arquivos PDF') || err.message.includes('apenas imagens')) {
        return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
});

// -----------------------
// INICIAR SERVIDOR
// -----------------------
const PORT = process.env.PORT || 3000;
const localIP = getLocalIP();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse de outro dispositivo: http://${localIP}:${PORT}`);
    console.log(`💻 Local: http://localhost:${PORT}`);
    console.log(`🔐 Login: http://${localIP}:${PORT}/auth/login`);
});

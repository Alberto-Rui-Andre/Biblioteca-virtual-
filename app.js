// app.js - COMPLETO E CORRIGIDO
const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql2/promise');
const os = require('os');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

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

// Criar pastas de upload se não existirem
const uploadsDir = 'uploads';
const pdfsDir = 'uploads/pdfs';
const coversDir = 'uploads/covers';

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
}
if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
}

// Configuração do multer para uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'arquivo_pdf') {
            cb(null, 'uploads/pdfs/');
        } else if (file.fieldname === 'capa') {
            cb(null, 'uploads/covers/');
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'arquivo_pdf') {
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new Error('Apenas arquivos PDF são permitidos'));
            }
        } else if (file.fieldname === 'capa') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Apenas imagens são permitidas'));
            }
        } else {
            cb(new Error('Campo de upload não reconhecido'));
        }
    }
});

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
        res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
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


// Antes de usar as rotas, adicione:
console.log('📦 Carregando rotas...');
console.log('✅ Carregando rotas admin:', require.resolve('./routes/admin'))
// -----------------------
// ROTAS DO SISTEMA
// -----------------------
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/professor', require('./routes/professor'));

// 🎯 ROTA PARA LIVROS (INCLUINDO ROTA DO PROFESSOR)
const livrosRouter = express.Router();

// GET todos os livros (com filtro para professor)
livrosRouter.get('/', async (req, res) => {
    try {
        const db = req.db;
        const user = req.session.user;
        
        let query = `
            SELECT 
                l.*,
                a.nome as autor_nome,
                c.nome as categoria_nome,
                u.nome as professor_nome
            FROM livros l
            LEFT JOIN autores a ON l.id_autor = a.id
            LEFT JOIN categorias c ON l.id_categoria = c.id
            LEFT JOIN usuarios u ON l.id_professor = u.id
        `;
        
        let params = [];
        
        // Se for professor e estiver buscando seus próprios livros
        if (user && user.tipo === 'professor' && req.query.meusLivros === 'true') {
            query += ' WHERE l.id_professor = ?';
            params.push(user.id);
        }
        
        query += ' ORDER BY l.criado_em DESC';
        
        const [livros] = await db.execute(query, params);
        res.json(livros);
    } catch (error) {
        console.error('Erro ao carregar livros:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET livros do professor (rota específica)
livrosRouter.get('/professor', verificarAutenticacao(['professor']), async (req, res) => {
    try {
        console.log('📚 Carregando livros do professor...');
        const db = req.db;
        const professorId = req.session.user.id;
        
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
            WHERE l.id_professor = ?
            ORDER BY l.criado_em DESC
        `;
        
        const [livros] = await db.execute(query, [professorId]);
        console.log(`✅ Encontrados ${livros.length} livros para o professor ID: ${professorId}`);
        res.json(livros);
    } catch (error) {
        console.error('❌ Erro ao carregar livros do professor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET livro por ID
livrosRouter.get('/:id', async (req, res) => {
    try {
        const db = req.db;
        const [livros] = await db.execute(`
            SELECT 
                l.*,
                a.nome as autor_nome,
                c.nome as categoria_nome,
                u.nome as professor_nome
            FROM livros l
            LEFT JOIN autores a ON l.id_autor = a.id
            LEFT JOIN categorias c ON l.id_categoria = c.id
            LEFT JOIN usuarios u ON l.id_professor = u.id
            WHERE l.id = ?
        `, [req.params.id]);
        
        if (livros.length === 0) {
            return res.status(404).json({ error: 'Livro não encontrado' });
        }
        
        res.json(livros[0]);
    } catch (error) {
        console.error('Erro ao carregar livro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST criar livro
livrosRouter.post('/', verificarAutenticacao(['professor', 'admin']), upload.fields([
    { name: 'arquivo_pdf', maxCount: 1 },
    { name: 'capa', maxCount: 1 }
]), async (req, res) => {
    try {
        const db = req.db;
        const { titulo, id_autor, id_categoria, descricao } = req.body;
        const professorId = req.session.user.id;
        
        if (!titulo || !id_autor || !id_categoria) {
            return res.status(400).json({ error: 'Título, autor e categoria são obrigatórios' });
        }
        
        if (!req.files || !req.files['arquivo_pdf']) {
            return res.status(400).json({ error: 'Arquivo PDF é obrigatório' });
        }
        
        const pdfFile = req.files['arquivo_pdf'][0];
        let capaFile = null;
        
        if (req.files['capa']) {
            capaFile = req.files['capa'][0];
        }
        
        const [result] = await db.execute(
            `INSERT INTO livros 
             (titulo, id_autor, id_categoria, descricao, arquivo_pdf, capa, id_professor) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                titulo,
                id_autor,
                id_categoria,
                descricao || null,
                pdfFile.filename,
                capaFile ? capaFile.filename : null,
                professorId
            ]
        );
        
        res.status(201).json({
            id: result.insertId,
            message: 'Livro cadastrado com sucesso',
            titulo,
            arquivo_pdf: pdfFile.filename,
            capa: capaFile ? capaFile.filename : null
        });
    } catch (error) {
        console.error('Erro ao cadastrar livro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT atualizar livro
livrosRouter.put('/:id', verificarAutenticacao(['professor', 'admin']), upload.fields([
    { name: 'arquivo_pdf', maxCount: 1 },
    { name: 'capa', maxCount: 1 }
]), async (req, res) => {
    try {
        const db = req.db;
        const livroId = req.params.id;
        const { titulo, id_autor, id_categoria, descricao } = req.body;
        const user = req.session.user;
        
        // Verificar se o livro existe e se o usuário tem permissão
        const [livroExistente] = await db.execute(
            'SELECT id_professor FROM livros WHERE id = ?',
            [livroId]
        );
        
        if (livroExistente.length === 0) {
            return res.status(404).json({ error: 'Livro não encontrado' });
        }
        
        // Se for professor, só pode editar seus próprios livros
        if (user.tipo === 'professor' && livroExistente[0].id_professor !== user.id) {
            return res.status(403).json({ error: 'Acesso não autorizado' });
        }
        
        // Preparar campos para atualização
        let updateFields = ['modificado_em = NOW()'];
        let updateValues = [];
        
        if (titulo) {
            updateFields.push('titulo = ?');
            updateValues.push(titulo);
        }
        
        if (id_autor) {
            updateFields.push('id_autor = ?');
            updateValues.push(id_autor);
        }
        
        if (id_categoria) {
            updateFields.push('id_categoria = ?');
            updateValues.push(id_categoria);
        }
        
        if (descricao !== undefined) {
            updateFields.push('descricao = ?');
            updateValues.push(descricao);
        }
        
        // Verificar se há novo arquivo PDF
        if (req.files && req.files['arquivo_pdf']) {
            const pdfFile = req.files['arquivo_pdf'][0];
            updateFields.push('arquivo_pdf = ?');
            updateValues.push(pdfFile.filename);
        }
        
        // Verificar se há nova capa
        if (req.files && req.files['capa']) {
            const capaFile = req.files['capa'][0];
            updateFields.push('capa = ?');
            updateValues.push(capaFile.filename);
        }
        
        updateValues.push(livroId);
        
        const updateQuery = `UPDATE livros SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await db.execute(updateQuery, updateValues);
        
        res.json({
            success: true,
            message: 'Livro atualizado com sucesso',
            id: livroId
        });
    } catch (error) {
        console.error('Erro ao atualizar livro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE remover livro
livrosRouter.delete('/:id', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const db = req.db;
        const livroId = req.params.id;
        const user = req.session.user;
        
        // Verificar se o livro existe e se o usuário tem permissão
        const [livro] = await db.execute(
            'SELECT id, id_professor, arquivo_pdf, capa FROM livros WHERE id = ?',
            [livroId]
        );
        
        if (livro.length === 0) {
            return res.status(404).json({ error: 'Livro não encontrado' });
        }
        
        // Se for professor, só pode deletar seus próprios livros
        if (user.tipo === 'professor' && livro[0].id_professor !== user.id) {
            return res.status(403).json({ error: 'Acesso não autorizado' });
        }
        
        // Deletar arquivos físicos
        try {
            if (livro[0].arquivo_pdf) {
                const pdfPath = path.join(__dirname, 'uploads/pdfs', livro[0].arquivo_pdf);
                if (fs.existsSync(pdfPath)) {
                    fs.unlinkSync(pdfPath);
                }
            }
            if (livro[0].capa) {
                const capaPath = path.join(__dirname, 'uploads/covers', livro[0].capa);
                if (fs.existsSync(capaPath)) {
                    fs.unlinkSync(capaPath);
                }
            }
        } catch (fileError) {
            console.warn('Erro ao deletar arquivos físicos:', fileError);
        }
        
        // Deletar do banco de dados
        await db.execute('DELETE FROM livros WHERE id = ?', [livroId]);
        
        res.json({
            success: true,
            message: 'Livro removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao remover livro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Montar rota de livros
app.use('/api/livros', livrosRouter);

// ROTA DE AUTORES
const autoresRouter = express.Router();

// GET todos os autores
autoresRouter.get('/', async (req, res) => {
    try {
        const db = req.db;
        const [autores] = await db.execute(`
            SELECT a.*, COUNT(l.id) as total_livros 
            FROM autores a 
            LEFT JOIN livros l ON a.id = l.id_autor 
            GROUP BY a.id
            ORDER BY a.nome
        `);
        res.json(autores);
    } catch (error) {
        console.error('Erro ao carregar autores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET autor por ID
autoresRouter.get('/:id', async (req, res) => {
    try {
        const db = req.db;
        const [autores] = await db.execute('SELECT * FROM autores WHERE id = ?', [req.params.id]);
        
        if (autores.length === 0) {
            return res.status(404).json({ error: 'Autor não encontrado' });
        }
        
        res.json(autores[0]);
    } catch (error) {
        console.error('Erro ao carregar autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST criar autor
autoresRouter.post('/', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const { nome, nacionalidade, data_nascimento, biografia } = req.body;
        
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ error: 'Nome do autor é obrigatório' });
        }
        
        const db = req.db;
        const [result] = await db.execute(
            'INSERT INTO autores (nome, nacionalidade, data_nascimento, biografia) VALUES (?, ?, ?, ?)',
            [
                nome.trim(),
                nacionalidade ? nacionalidade.trim() : null,
                data_nascimento || null,
                biografia ? biografia.trim() : null
            ]
        );
        
        res.json({
            id: result.insertId,
            nome: nome.trim(),
            mensagem: 'Autor criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT atualizar autor
autoresRouter.put('/:id', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, nacionalidade, data_nascimento, biografia } = req.body;
        
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ error: 'Nome do autor é obrigatório' });
        }
        
        const db = req.db;
        await db.execute(
            'UPDATE autores SET nome = ?, nacionalidade = ?, data_nascimento = ?, biografia = ? WHERE id = ?',
            [
                nome.trim(),
                nacionalidade ? nacionalidade.trim() : null,
                data_nascimento || null,
                biografia ? biografia.trim() : null,
                id
            ]
        );
        
        res.json({
            id,
            nome: nome.trim(),
            mensagem: 'Autor atualizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atualizar autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE remover autor
autoresRouter.delete('/:id', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.db;
        
        // Verificar se há livros usando este autor
        const [livros] = await db.execute('SELECT COUNT(*) as total FROM livros WHERE id_autor = ?', [id]);
        
        if (livros[0].total > 0) {
            return res.status(400).json({ error: 'Não é possível excluir autor com livros associados' });
        }
        
        await db.execute('DELETE FROM autores WHERE id = ?', [id]);
        
        res.json({ mensagem: 'Autor removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Montar rota de autores
app.use('/api/autores', autoresRouter);

// ROTA DE CATEGORIAS
const categoriasRouter = express.Router();

// GET todas categorias
categoriasRouter.get('/', async (req, res) => {
    try {
        const db = req.db;
        const [categorias] = await db.execute(`
            SELECT c.*, COUNT(l.id) as total_livros 
            FROM categorias c 
            LEFT JOIN livros l ON c.id = l.id_categoria 
            GROUP BY c.id
            ORDER BY c.nome
        `);
        res.json(categorias);
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET categoria por ID
categoriasRouter.get('/:id', async (req, res) => {
    try {
        const db = req.db;
        const [categorias] = await db.execute('SELECT * FROM categorias WHERE id = ?', [req.params.id]);
        
        if (categorias.length === 0) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }
        
        res.json(categorias[0]);
    } catch (error) {
        console.error('Erro ao carregar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST criar categoria
categoriasRouter.post('/', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }
        
        const db = req.db;
        const [result] = await db.execute(
            'INSERT INTO categorias (nome, descricao) VALUES (?, ?)',
            [nome.trim(), descricao ? descricao.trim() : '']
        );
        
        res.json({
            id: result.insertId,
            nome: nome.trim(),
            descricao: descricao ? descricao.trim() : '',
            mensagem: 'Categoria criada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT atualizar categoria
categoriasRouter.put('/:id', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao } = req.body;
        
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }
        
        const db = req.db;
        await db.execute(
            'UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?',
            [nome.trim(), descricao ? descricao.trim() : '', id]
        );
        
        res.json({
            id,
            nome: nome.trim(),
            descricao: descricao ? descricao.trim() : '',
            mensagem: 'Categoria atualizada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE remover categoria
categoriasRouter.delete('/:id', verificarAutenticacao(['professor', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.db;
        
        // Verificar se há livros usando esta categoria
        const [livros] = await db.execute('SELECT COUNT(*) as total FROM livros WHERE id_categoria = ?', [id]);
        
        if (livros[0].total > 0) {
            return res.status(400).json({ error: 'Não é possível excluir categoria com livros associados' });
        }
        
        await db.execute('DELETE FROM categorias WHERE id = ?', [id]);
        
        res.json({ mensagem: 'Categoria removida com sucesso' });
    } catch (error) {
        console.error('Erro ao remover categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Montar rota de categorias
app.use('/api/categorias', categoriasRouter);

// -----------------------
// ROTAS DE PÁGINAS
// -----------------------

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
app.use('/recuperar-senha', recuperarSenhaRouter);

// -----------------------
// NOVAS ROTAS DE API PARA O PROFESSOR
// -----------------------

// Info do usuário logado
app.get('/api/user-info', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    res.json(req.session.user);
});

// API para informações do usuário atual
app.get('/api/usuario/atual', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    res.json(req.session.user);
});

// API para estatísticas do professor
app.get('/api/professor/estatisticas', verificarAutenticacao(['professor']), async (req, res) => {
    try {
        const db = req.db;
        const professorId = req.session.user.id;
        
        // Total de livros do professor
        const [totalLivrosResult] = await db.execute(
            'SELECT COUNT(*) as total FROM livros WHERE id_professor = ?',
            [professorId]
        );
        
        // Total de autores
        const [totalAutoresResult] = await db.execute('SELECT COUNT(*) as total FROM autores');
        
        // Livros deste mês do professor
        const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const [livrosMesResult] = await db.execute(
            'SELECT COUNT(*) as total FROM livros WHERE id_professor = ? AND criado_em >= ?',
            [professorId, primeiroDiaMes]
        );
        
        // Total de categorias
        const [totalCategoriasResult] = await db.execute('SELECT COUNT(*) as total FROM categorias');
        
        res.json({
            totalLivros: totalLivrosResult[0].total || 0,
            totalAutores: totalAutoresResult[0].total || 0,
            livrosEsteMes: livrosMesResult[0].total || 0,
            totalCategorias: totalCategoriasResult[0].total || 0
        });
    } catch (error) {
        console.error('Erro ao carregar estatísticas do professor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// API para atividade recente do professor
app.get('/api/professor/atividade-recente', verificarAutenticacao(['professor']), async (req, res) => {
    try {
        const db = req.db;
        const professorId = req.session.user.id;
        
        // Buscar últimos 5 livros cadastrados pelo professor
        const [livros] = await db.execute(
            `SELECT l.*, a.nome as autor_nome, c.nome as categoria_nome 
             FROM livros l
             LEFT JOIN autores a ON l.id_autor = a.id
             LEFT JOIN categorias c ON l.id_categoria = c.id
             WHERE l.id_professor = ?
             ORDER BY l.criado_em DESC
             LIMIT 5`,
            [professorId]
        );
        
        const atividades = livros.map(livro => ({
            tipo: 'livro',
            descricao: `Livro "${livro.titulo}" cadastrado`,
            data: livro.criado_em
        }));
        
        res.json(atividades);
    } catch (error) {
        console.error('Erro ao carregar atividade recente do professor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Redefinir senha
app.post('/api/redefinir-senha', async (req, res) => {
    try {
        const { email } = req.body;
        const db = req.db;
        
        // Verificar se o usuário existe
        const [usuarios] = await db.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        
        if (usuarios.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Gerar nova senha temporária
        const novaSenha = Math.random().toString(36).slice(-8);
        const senhaHash = crypto.createHash('sha256').update(novaSenha).digest('hex');
        
        // Atualizar senha no banco
        await db.execute(
            'UPDATE usuarios SET senha_hash = ? WHERE email = ?',
            [senhaHash, email]
        );
        
        res.json({ 
            success: true, 
            message: 'Senha redefinida com sucesso',
            novaSenha: novaSenha
        });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// -----------------------
// ROTAS DE API EXISTENTES
// -----------------------

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
            LIMIT 6
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

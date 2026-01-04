const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Criar diretórios de upload se não existirem
const uploadDirs = ['uploads/pdfs', 'uploads/covers'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('✅ Diretório criado:', dir);
    }
});

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'uploads/';
        if (file.fieldname === 'arquivo_pdf') {
            folder = 'uploads/pdfs/';
        } else if (file.fieldname === 'capa') {
            folder = 'uploads/covers/';
        }
        cb(null, folder);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = file.fieldname + '-' + uniqueSuffix + extension;
        console.log('📁 Nome do arquivo gerado:', filename);
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    console.log('📄 Processando arquivo:', file.originalname, 'Tipo:', file.mimetype);
    
    if (file.fieldname === 'arquivo_pdf') {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF são permitidos para o livro'), false);
        }
    } else if (file.fieldname === 'capa') {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas para a capa'), false);
        }
    } else {
        cb(null, true);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// Middleware de autenticação
function auth(req, res, next) {
    if (!req.session.user) {
        console.log('❌ Usuário não autenticado');
        return res.status(401).json({ error: 'Não autenticado' });
    }
    console.log('✅ Usuário autenticado:', req.session.user.email);
    next();
}

// Middleware para verificar se é professor ou admin
function isProfessorOrAdmin(req, res, next) {
    const user = req.session.user;
    if (user && (user.tipo === 'professor' || user.tipo === 'admin')) {
        console.log('✅ Acesso permitido para:', user.tipo);
        next();
    } else {
        console.log('❌ Acesso negado para:', user?.tipo);
        res.status(403).json({ error: 'Acesso negado. Apenas professores e administradores podem realizar esta ação.' });
    }
}

// GET - Listar todos os livros (público)
router.get('/livros', async (req, res) => {
    try {
        console.log('📚 Buscando todos os livros...');
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
            ORDER BY l.titulo
        `;
        const [livros] = await req.db.execute(query);
        console.log(`✅ Encontrados ${livros.length} livros`);
        res.json(livros);
    } catch (error) {
        console.error('❌ Erro ao carregar livros:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao carregar livros' });
    }
});

// GET - Meus livros (apenas para professores)
router.get('/meus-livros', auth, async (req, res) => {
    try {
        const user = req.session.user;
        console.log('📚 Buscando livros do usuário:', user.email);
        
        if (user.tipo !== 'professor' && user.tipo !== 'admin') {
            console.log('❌ Acesso negado - tipo de usuário:', user.tipo);
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const query = `
            SELECT 
                l.*,
                a.nome as autor_nome,
                c.nome as categoria_nome
            FROM livros l
            LEFT JOIN autores a ON l.id_autor = a.id
            LEFT JOIN categorias c ON l.id_categoria = c.id
            WHERE l.id_professor = ?
            ORDER BY l.titulo
        `;
        const [livros] = await req.db.execute(query, [user.id]);
        console.log(`✅ Encontrados ${livros.length} livros do usuário`);
        res.json(livros);
    } catch (error) {
        console.error('❌ Erro ao carregar meus livros:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao carregar seus livros' });
    }
});

// POST - Cadastrar novo livro
router.post('/', auth, isProfessorOrAdmin, upload.fields([{ name: 'arquivo_pdf', maxCount: 1 }, { name: 'capa', maxCount: 1 }]), async (req, res) => {
    console.log('=== TENTATIVA DE CADASTRO DE LIVRO ===');
    console.log('👤 Usuário:', req.session.user.email);
    console.log('📝 Body:', req.body);
    console.log('📁 Files:', req.files);
    
    try {
        const { titulo, id_autor, id_categoria, descricao } = req.body;
        const id_professor = req.session.user.id;

        // Validações básicas
        if (!titulo) {
            console.log('❌ Título não informado');
            return res.status(400).json({ error: 'Título do livro é obrigatório' });
        }

        // Verificar se arquivo PDF foi enviado
        if (!req.files || !req.files['arquivo_pdf']) {
            console.log('❌ Arquivo PDF não enviado');
            return res.status(400).json({ error: 'Arquivo PDF é obrigatório' });
        }

        const arquivo_pdf = req.files['arquivo_pdf'][0].filename;
        const capa = req.files['capa'] ? req.files['capa'][0].filename : null;

        console.log('💾 Dados para inserção:', {
            titulo, 
            id_autor: id_autor || 'NULL', 
            id_categoria: id_categoria || 'NULL', 
            id_professor, 
            descricao: descricao || 'Sem descrição', 
            arquivo_pdf, 
            capa: capa || 'NULL'
        });

        const query = `
            INSERT INTO livros (titulo, id_autor, id_categoria, id_professor, descricao, arquivo_pdf, capa)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await req.db.execute(query, [
            titulo, 
            id_autor || null, 
            id_categoria || null, 
            id_professor, 
            descricao || '', 
            arquivo_pdf, 
            capa
        ]);

        console.log('✅ Livro cadastrado com ID:', result.insertId);

        res.json({ 
            success: true,
            message: 'Livro cadastrado com sucesso!', 
            id: result.insertId 
        });
    } catch (error) {
        console.error('❌ Erro ao cadastrar livro:', error);
        console.error('Stack trace:', error.stack);
        
        // Limpar arquivos enviados em caso de erro
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) {
                            console.error('Erro ao remover arquivo:', file.path, err);
                        } else {
                            console.log('🗑️ Arquivo removido devido a erro:', file.path);
                        }
                    });
                });
            });
        }
        
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
    }
});

// DELETE - Remover livro
router.delete('/livros/:id', auth, async (req, res) => {
    try {
        const livroId = req.params.id;
        const user = req.session.user;

        console.log('🗑️ Tentativa de remover livro ID:', livroId, 'por:', user.email);

        // Verificar permissões
        if (user.tipo !== 'admin') {
            const [livros] = await req.db.execute('SELECT id_professor FROM livros WHERE id = ?', [livroId]);
            if (livros.length === 0) {
                console.log('❌ Livro não encontrado');
                return res.status(404).json({ error: 'Livro não encontrado' });
            }
            if (livros[0].id_professor !== user.id) {
                console.log('❌ Usuário não é o proprietário do livro');
                return res.status(403).json({ error: 'Você só pode remover seus próprios livros' });
            }
        }

        await req.db.execute('DELETE FROM livros WHERE id = ?', [livroId]);
        console.log('✅ Livro removido com sucesso');
        res.json({ message: 'Livro removido com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao remover livro:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao remover livro' });
    }
});

// GET - Listar categorias
router.get('/categorias', async (req, res) => {
    try {
        console.log('📂 Buscando categorias...');
        const [categorias] = await req.db.execute('SELECT * FROM categorias ORDER BY nome');
        console.log(`✅ Encontradas ${categorias.length} categorias`);
        res.json(categorias);
    } catch (error) {
        console.error('❌ Erro ao carregar categorias:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao carregar categorias' });
    }
});

// GET - Buscar livro por ID
router.get('/livros/:id', async (req, res) => {
    try {
        const livroId = req.params.id;
        console.log('🔍 Buscando livro ID:', livroId);
        
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
            WHERE l.id = ?
        `;
        
        const [livros] = await req.db.execute(query, [livroId]);
        
        if (livros.length === 0) {
            console.log('❌ Livro não encontrado');
            return res.status(404).json({ error: 'Livro não encontrado' });
        }
        
        console.log('✅ Livro encontrado:', livros[0].titulo);
        res.json(livros[0]);
    } catch (error) {
        console.error('❌ Erro ao buscar livro:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar livro' });
    }
});

module.exports = router;

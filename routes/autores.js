const express = require("express");
const router = express.Router();

// Middleware de autenticação
function auth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    next();
}

// Middleware para verificar se é professor ou admin
function isProfessorOrAdmin(req, res, next) {
    const user = req.session.user;
    if (user && (user.tipo === 'professor' || user.tipo === 'admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Acesso negado' });
    }
}

// GET - Listar todos os autores (público)
router.get('/', async (req, res) => {
    try {
        const [autores] = await req.db.execute('SELECT * FROM autores ORDER BY nome');
        res.json(autores);
    } catch (error) {
        console.error('Erro ao carregar autores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Buscar autor por ID
router.get('/:id', async (req, res) => {
    try {
        const [autores] = await req.db.execute('SELECT * FROM autores WHERE id = ?', [req.params.id]);
        
        if (autores.length === 0) {
            return res.status(404).json({ error: 'Autor não encontrado' });
        }
        
        res.json(autores[0]);
    } catch (error) {
        console.error('Erro ao carregar autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST - Cadastrar novo autor
router.post('/', auth, isProfessorOrAdmin, async (req, res) => {
    try {
        const { nome, biografia, nacionalidade, data_nascimento } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome do autor é obrigatório' });
        }

        const query = `
            INSERT INTO autores (nome, biografia, nacionalidade, data_nascimento)
            VALUES (?, ?, ?, ?)
        `;
        
        const [result] = await req.db.execute(query, [
            nome, 
            biografia || null, 
            nacionalidade || null, 
            data_nascimento || null
        ]);

        res.json({ 
            message: 'Autor cadastrado com sucesso', 
            id: result.insertId 
        });
    } catch (error) {
        console.error('Erro ao cadastrar autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT - Atualizar autor
router.put('/:id', auth, isProfessorOrAdmin, async (req, res) => {
    try {
        const { nome, biografia, nacionalidade, data_nascimento } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome do autor é obrigatório' });
        }

        const query = `
            UPDATE autores 
            SET nome = ?, biografia = ?, nacionalidade = ?, data_nascimento = ?
            WHERE id = ?
        `;
        
        await req.db.execute(query, [
            nome, 
            biografia || null, 
            nacionalidade || null, 
            data_nascimento || null,
            req.params.id
        ]);

        res.json({ message: 'Autor atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE - Remover autor
router.delete('/:id', auth, async (req, res) => {
    try {
        const user = req.session.user;
        
        // Apenas admin pode remover autores
        if (user.tipo !== 'admin') {
            return res.status(403).json({ error: 'Apenas administradores podem remover autores' });
        }

        // Verificar se o autor está sendo usado em algum livro
        const [livros] = await req.db.execute('SELECT id FROM livros WHERE id_autor = ?', [req.params.id]);
        if (livros.length > 0) {
            return res.status(400).json({ error: 'Não é possível remover autor que possui livros cadastrados' });
        }

        await req.db.execute('DELETE FROM autores WHERE id = ?', [req.params.id]);
        res.json({ message: 'Autor removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover autor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
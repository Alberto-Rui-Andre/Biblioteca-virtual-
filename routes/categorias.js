const express = require('express');
const router = express.Router();

// GET todas categorias
router.get('/', async (req, res) => {
    try {
        const db = req.db;
        // Incluir contagem de livros por categoria
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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

module.exports = router;
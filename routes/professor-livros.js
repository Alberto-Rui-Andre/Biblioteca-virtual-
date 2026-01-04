// routes/professor-livros.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do multer para professor (mesma configuração do app.js)
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
    }
});

// Middleware para verificar se é professor
const verificarProfessor = (req, res, next) => {
    if (req.session.user && req.session.user.tipo === 'professor') {
        return next();
    }
    res.status(403).json({ error: 'Acesso não autorizado' });
};

// GET /professor - Listar livros do professor
router.get('/professor', verificarProfessor, async (req, res) => {
    try {
        console.log('📚 Carregando livros do professor...');
        const db = req.db;
        const professorId = req.session.user.id;
        
        const query = `
            SELECT 
                l.*,
                a.nome as autor_nome,
                c.nome as categoria_nome
            FROM livros l
            LEFT JOIN autores a ON l.id_autor = a.id
            LEFT JOIN categorias c ON l.id_categoria = c.id
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

// GET /professor/:id - Obter livro específico do professor
router.get('/professor/:id', verificarProfessor, async (req, res) => {
    try {
        const db = req.db;
        const professorId = req.session.user.id;
        const livroId = req.params.id;
        
        const query = `
            SELECT 
                l.*,
                a.nome as autor_nome,
                c.nome as categoria_nome
            FROM livros l
            LEFT JOIN autores a ON l.id_autor = a.id
            LEFT JOIN categorias c ON l.id_categoria = c.id
            WHERE l.id = ? AND l.id_professor = ?
        `;
        
        const [livros] = await db.execute(query, [livroId, professorId]);
        
        if (livros.length === 0) {
            return res.status(404).json({ error: 'Livro não encontrado ou acesso não autorizado' });
        }
        
        res.json(livros[0]);
    } catch (error) {
        console.error('Erro ao carregar livro do professor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT /professor/:id - Atualizar livro do professor
router.put('/professor/:id', verificarProfessor, upload.fields([
    { name: 'arquivo_pdf', maxCount: 1 },
    { name: 'capa', maxCount: 1 }
]), async (req, res) => {
    try {
        const db = req.db;
        const professorId = req.session.user.id;
        const livroId = req.params.id;
        const { titulo, id_autor, id_categoria, descricao } = req.body;
        
        // Verificar se o livro pertence ao professor
        const [verificacao] = await db.execute(
            'SELECT id FROM livros WHERE id = ? AND id_professor = ?',
            [livroId, professorId]
        );
        
        if (verificacao.length === 0) {
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
        
        // Se não houver campos para atualizar
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }
        
        updateValues.push(livroId, professorId);
        
        const updateQuery = `
            UPDATE livros 
            SET ${updateFields.join(', ')}
            WHERE id = ? AND id_professor = ?
        `;
        
        await db.execute(updateQuery, updateValues);
        
        res.json({ 
            success: true, 
            message: 'Livro atualizado com sucesso',
            id: livroId 
        });
    } catch (error) {
        console.error('Erro ao atualizar livro do professor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE /professor/:id - Deletar livro do professor
router.delete('/professor/:id', verificarProfessor, async (req, res) => {
    try {
        const db = req.db;
        const professorId = req.session.user.id;
        const livroId = req.params.id;
        
        // Verificar se o livro pertence ao professor
        const [verificacao] = await db.execute(
            'SELECT id, arquivo_pdf, capa FROM livros WHERE id = ? AND id_professor = ?',
            [livroId, professorId]
        );
        
        if (verificacao.length === 0) {
            return res.status(403).json({ error: 'Acesso não autorizado' });
        }
        
        const livro = verificacao[0];
        
        // Deletar arquivos físicos
        try {
            if (livro.arquivo_pdf) {
                const pdfPath = path.join(__dirname, '..', 'uploads/pdfs', livro.arquivo_pdf);
                if (fs.existsSync(pdfPath)) {
                    fs.unlinkSync(pdfPath);
                }
            }
            if (livro.capa) {
                const capaPath = path.join(__dirname, '..', 'uploads/covers', livro.capa);
                if (fs.existsSync(capaPath)) {
                    fs.unlinkSync(capaPath);
                }
            }
        } catch (fileError) {
            console.warn('Erro ao deletar arquivos físicos:', fileError);
        }
        
        // Deletar do banco de dados
        await db.execute(
            'DELETE FROM livros WHERE id = ? AND id_professor = ?',
            [livroId, professorId]
        );
        
        res.json({ 
            success: true, 
            message: 'Livro removido com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao deletar livro do professor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
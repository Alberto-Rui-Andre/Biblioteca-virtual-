const express = require("express");
const router = express.Router();
const path = require("path");
const bcrypt = require("bcryptjs");
const { simpleHash } = require("../utils/hash");

console.log('✅ Módulo admin.js carregado com sucesso!');
console.log('✅ Módulo admin.js carregado com sucesso!');

// Log das rotas disponíveis
console.log('📋 Rotas disponíveis em admin.js:');
console.log('- GET /admin/api/professores');
console.log('- POST /admin/cadastrar-professor');
console.log('- PUT /admin/editar-professor/:id');
console.log('- DELETE /admin/remover-professor/:id');

// Middleware para verificar se é admin
function isAdmin(req, res, next) {
    console.log(`🔐 Verificando admin: ${req.session.user ? req.session.user.tipo : 'sem sessão'}`);
    if (req.session.user && req.session.user.tipo === 'admin') {
        next();
    } else {
        res.status(403).json({ error: "Acesso negado" });
    }
}

// ============= ROTAS DE TESTE =============
router.get('/test', (req, res) => {
    console.log('✅ Rota /admin/test acessada!');
    res.json({ message: 'Rota admin funcionando!', timestamp: new Date() });
});

router.post('/api/test', (req, res) => {
    console.log('✅ Rota POST /admin/api/test acessada!', req.body);
    res.json({ 
        success: true, 
        message: 'API test funcionando',
        received: req.body 
    });
});

// ============= ROTAS PRINCIPAIS =============

// Painel do admin
router.get("/", isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/admin.html"));
});

// ============= API DE ESTATÍSTICAS =============
router.get("/api/estatisticas", isAdmin, async (req, res) => {
    try {
        const [totalUsuarios] = await req.db.execute("SELECT COUNT(*) as total FROM usuarios");
        const [totalEstudantes] = await req.db.execute("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'estudante'");
        const [totalProfessores] = await req.db.execute("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'professor'");
        const [totalVisitantes] = await req.db.execute("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'visitante'");
        const [totalLivros] = await req.db.execute("SELECT COUNT(*) as total FROM livros");
        const [totalAutores] = await req.db.execute("SELECT COUNT(*) as total FROM autores");

        res.json({
            totalUsuarios: totalUsuarios[0].total,
            totalEstudantes: totalEstudantes[0].total,
            totalProfessores: totalProfessores[0].total,
            totalVisitantes: totalVisitantes[0].total,
            totalLivros: totalLivros[0].total,
            totalAutores: totalAutores[0].total
        });
    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= API DE ATIVIDADE RECENTE =============
router.get("/api/atividade-recente", isAdmin, async (req, res) => {
    try {
        // Últimos 5 livros cadastrados
        const [livros] = await req.db.execute(`
            SELECT l.*, a.nome as autor_nome 
            FROM livros l 
            LEFT JOIN autores a ON l.id_autor = a.id 
            ORDER BY l.criado_em DESC 
            LIMIT 5
        `);
        
        // Últimos 5 usuários cadastrados
        const [usuarios] = await req.db.execute(`
            SELECT id, nome, email, tipo, criado_em 
            FROM usuarios 
            ORDER BY criado_em DESC 
            LIMIT 5
        `);
        
        const atividade = [
            ...livros.map(l => ({
                tipo: 'livro',
                descricao: `Livro "${l.titulo}" cadastrado`,
                data: l.criado_em
            })),
            ...usuarios.map(u => ({
                tipo: 'usuario',
                descricao: `Usuário "${u.nome}" (${u.tipo}) cadastrado`,
                data: u.criado_em
            }))
        ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
        
        res.json(atividade);
    } catch (error) {
        console.error("Erro ao carregar atividade recente:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= API DE CATEGORIAS =============
router.get("/api/categorias", isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*,
                COUNT(l.id) as total_livros
            FROM categorias c
            LEFT JOIN livros l ON c.id = l.id_categoria
            GROUP BY c.id
            ORDER BY c.nome
        `;
        const [categorias] = await req.db.execute(query);
        res.json(categorias);
    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= API DE USUÁRIOS =============
router.get("/api/usuarios", isAdmin, async (req, res) => {
    try {
        const [usuarios] = await req.db.execute(`
            SELECT id, nome, email, numero_matricula, numero_agente, tipo, criado_em 
            FROM usuarios 
            ORDER BY nome
        `);
        res.json(usuarios);
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/api/usuarios/:id", isAdmin, async (req, res) => {
    try {
        const [usuarios] = await req.db.execute(
            "SELECT id, nome, email, numero_matricula, tipo FROM usuarios WHERE id = ?", 
            [req.params.id]
        );
        
        if (usuarios.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        
        res.json(usuarios[0]);
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.put("/api/usuarios/:id", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_matricula } = req.body;
        
        await req.db.execute(
            "UPDATE usuarios SET nome = ?, email = ?, numero_matricula = ? WHERE id = ?",
            [nome, email, numero_matricula, req.params.id]
        );

        res.json({ 
            success: true,
            message: "Usuário atualizado com sucesso"
        });
    } catch (error) {
        console.error("Erro ao editar usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.delete("/api/usuarios/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute("DELETE FROM usuarios WHERE id = ?", [req.params.id]);
        res.json({ 
            success: true,
            message: "Usuário removido com sucesso" 
        });
    } catch (error) {
        console.error("Erro ao remover usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= API DE PROFESSORES =============
router.get("/api/professores", isAdmin, async (req, res) => {
    try {
        const [professores] = await req.db.execute(`
            SELECT id, nome, email, numero_agente, criado_em 
            FROM usuarios 
            WHERE tipo = 'professor' 
            ORDER BY nome
        `);
        res.json(professores);
    } catch (error) {
        console.error("Erro ao carregar professores:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/api/professores/:id", isAdmin, async (req, res) => {
    try {
        const [professores] = await req.db.execute(
            "SELECT id, nome, email, numero_agente FROM usuarios WHERE id = ? AND tipo = 'professor'", 
            [req.params.id]
        );
        
        if (professores.length === 0) {
            return res.status(404).json({ error: "Professor não encontrado" });
        }
        
        res.json(professores[0]);
    } catch (error) {
        console.error("Erro ao buscar professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.post("/api/professores", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_agente, senha } = req.body;
        
        console.log('📝 Dados recebidos para cadastrar professor:', req.body);
        
        // Validações básicas
        if (!nome || !email || !numero_agente) {
            return res.status(400).json({ error: "Nome, email e número de agente são obrigatórios" });
        }
        
        // Verificar se email já existe
        const [existingEmail] = await req.db.execute("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: "Email já cadastrado" });
        }

        // Verificar se número de agente já existe
        const [existingAgente] = await req.db.execute("SELECT id FROM usuarios WHERE numero_agente = ?", [numero_agente]);
        if (existingAgente.length > 0) {
            return res.status(400).json({ error: "Número de agente já cadastrado" });
        }

        const senhaHash = simpleHash(senha || "123456");
        
        const [result] = await req.db.execute(
            "INSERT INTO usuarios (nome, email, numero_agente, senha_hash, tipo) VALUES (?, ?, ?, ?, 'professor')",
            [nome, email, numero_agente, senhaHash]
        );

        res.status(201).json({ 
            success: true,
            message: "Professor cadastrado com sucesso",
            id: result.insertId,
            nome,
            email,
            numero_agente
        });
    } catch (error) {
        console.error("Erro ao cadastrar professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.put("/api/professores/:id", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_agente, senha } = req.body;
        const professorId = req.params.id;

        console.log(`📝 Atualizando professor ID: ${professorId}`, req.body);

        // Verificar se o professor existe
        const [professor] = await req.db.execute(
            "SELECT * FROM usuarios WHERE id = ? AND tipo = 'professor'", 
            [professorId]
        );
        
        if (professor.length === 0) {
            return res.status(404).json({ error: "Professor não encontrado" });
        }

        let query = "UPDATE usuarios SET nome = ?, email = ?, numero_agente = ?";
        const params = [nome, email, numero_agente];

        if (senha && senha.trim() !== '') {
            const senhaHash = simpleHash(senha);
            query += ", senha_hash = ?";
            params.push(senhaHash);
        }

        query += " WHERE id = ? AND tipo = 'professor'";
        params.push(professorId);

        await req.db.execute(query, params);
        
        res.json({ 
            success: true,
            message: "Professor atualizado com sucesso",
            id: professorId
        });
    } catch (error) {
        console.error("Erro ao editar professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.delete("/api/professores/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute("DELETE FROM usuarios WHERE id = ? AND tipo = 'professor'", [req.params.id]);
        res.json({ 
            success: true,
            message: "Professor removido com sucesso" 
        });
    } catch (error) {
        console.error("Erro ao remover professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});


// ============= API DE PROFESSORES =============
router.get("/api/professores", isAdmin, async (req, res) => {
    try {
        const [professores] = await req.db.execute(`
            SELECT id, nome, email, numero_agente, criado_em 
            FROM usuarios 
            WHERE tipo = 'professor' 
            ORDER BY nome
        `);
        res.json(professores);
    } catch (error) {
        console.error("Erro ao carregar professores:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/api/professores/:id", isAdmin, async (req, res) => {
    try {
        const [professores] = await req.db.execute(
            "SELECT id, nome, email, numero_agente FROM usuarios WHERE id = ? AND tipo = 'professor'", 
            [req.params.id]
        );
        
        if (professores.length === 0) {
            return res.status(404).json({ error: "Professor não encontrado" });
        }
        
        res.json(professores[0]);
    } catch (error) {
        console.error("Erro ao buscar professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ADICIONE ESTA ROTA (se não existir):
router.post("/api/professores", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_agente, senha } = req.body;
        
        console.log('📝 Dados recebidos para cadastrar professor:', req.body);
        
        // Validações básicas
        if (!nome || !email || !numero_agente) {
            return res.status(400).json({ error: "Nome, email e número de agente são obrigatórios" });
        }
        
        // Verificar se email já existe
        const [existingEmail] = await req.db.execute("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: "Email já cadastrado" });
        }

        // Verificar se número de agente já existe
        const [existingAgente] = await req.db.execute("SELECT id FROM usuarios WHERE numero_agente = ?", [numero_agente]);
        if (existingAgente.length > 0) {
            return res.status(400).json({ error: "Número de agente já cadastrado" });
        }

        const senhaHash = simpleHash(senha || "123456");
        
        const [result] = await req.db.execute(
            "INSERT INTO usuarios (nome, email, numero_agente, senha_hash, tipo) VALUES (?, ?, ?, ?, 'professor')",
            [nome, email, numero_agente, senhaHash]
        );

        res.status(201).json({ 
            success: true,
            message: "Professor cadastrado com sucesso",
            id: result.insertId,
            nome,
            email,
            numero_agente
        });
    } catch (error) {
        console.error("Erro ao cadastrar professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.put("/api/professores/:id", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_agente, senha } = req.body;
        const professorId = req.params.id;

        console.log(`📝 Atualizando professor ID: ${professorId}`, req.body);

        // Verificar se o professor existe
        const [professor] = await req.db.execute(
            "SELECT * FROM usuarios WHERE id = ? AND tipo = 'professor'", 
            [professorId]
        );
        
        if (professor.length === 0) {
            return res.status(404).json({ error: "Professor não encontrado" });
        }

        let query = "UPDATE usuarios SET nome = ?, email = ?, numero_agente = ?";
        const params = [nome, email, numero_agente];

        if (senha && senha.trim() !== '') {
            const senhaHash = simpleHash(senha);
            query += ", senha_hash = ?";
            params.push(senhaHash);
        }

        query += " WHERE id = ? AND tipo = 'professor'";
        params.push(professorId);

        await req.db.execute(query, params);
        
        res.json({ 
            success: true,
            message: "Professor atualizado com sucesso",
            id: professorId
        });
    } catch (error) {
        console.error("Erro ao editar professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.delete("/api/professores/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute("DELETE FROM usuarios WHERE id = ? AND tipo = 'professor'", [req.params.id]);
        res.json({ 
            success: true,
            message: "Professor removido com sucesso" 
        });
    } catch (error) {
        console.error("Erro ao remover professor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= API DE LIVROS =============
router.get("/api/livros", isAdmin, async (req, res) => {
    try {
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
        res.json(livros);
    } catch (error) {
        console.error("Erro ao carregar livros:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.delete("/api/livros/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute('DELETE FROM livros WHERE id = ?', [req.params.id]);
        res.json({ 
            success: true,
            message: 'Livro removido com sucesso' 
        });
    } catch (error) {
        console.error("Erro ao remover livro:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= API DE AUTORES =============
router.get("/api/autores", isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.*,
                COUNT(l.id) as total_livros
            FROM autores a
            LEFT JOIN livros l ON a.id = l.id_autor
            GROUP BY a.id
            ORDER BY a.nome
        `;
        const [autores] = await req.db.execute(query);
        res.json(autores);
    } catch (error) {
        console.error("Erro ao carregar autores:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/api/autores/:id", isAdmin, async (req, res) => {
    try {
        const [autores] = await req.db.execute('SELECT * FROM autores WHERE id = ?', [req.params.id]);
        if (autores.length === 0) {
            return res.status(404).json({ error: 'Autor não encontrado' });
        }
        res.json(autores[0]);
    } catch (error) {
        console.error("Erro ao carregar autor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ============= ROTAS ANTIGAS (MANTIDAS PARA COMPATIBILIDADE) =============
router.post("/redefinir-senha", async (req, res) => {
    const { email } = req.body;
    // Sua lógica aqui
});

router.post("/redefinir-senha-usuario/:id", isAdmin, async (req, res) => {
    try {
        const { senha } = req.body;
        const usuarioId = req.params.id;
        
        if (!senha || senha.length < 6) {
            return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
        }
        
        const senhaHash = simpleHash(senha);
        
        await req.db.execute(
            "UPDATE usuarios SET senha_hash = ? WHERE id = ?",
            [senhaHash, usuarioId]
        );
        
        res.json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.post("/cadastrar-professor", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_agente, senha } = req.body;
        
        // Verificar se email já existe
        const [existing] = await req.db.execute("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(400).send("Email já cadastrado");
        }

        const senhaHash = simpleHash(senha || "123456");
        
        await req.db.execute(
            "INSERT INTO usuarios (nome, email, numero_agente, senha_hash, tipo) VALUES (?, ?, ?, ?, 'professor')",
            [nome, email, numero_agente, senhaHash]
        );

        res.send("Professor cadastrado com sucesso");
    } catch (error) {
        console.error("Erro ao cadastrar professor:", error);
        res.status(500).send("Erro interno do servidor");
    }
});

router.put("/editar-professor/:id", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_agente, senha } = req.body;
        const professorId = req.params.id;

        let query = "UPDATE usuarios SET nome = ?, email = ?, numero_agente = ?";
        const params = [nome, email, numero_agente];

        if (senha) {
            const senhaHash = simpleHash(senha);
            query += ", senha_hash = ?";
            params.push(senhaHash);
        }

        query += " WHERE id = ?";
        params.push(professorId);

        await req.db.execute(query, params);
        res.send("Professor atualizado com sucesso");
    } catch (error) {
        console.error("Erro ao editar professor:", error);
        res.status(500).send("Erro interno do servidor");
    }
});

router.post("/cadastrar-autor", isAdmin, async (req, res) => {
    try {
        const { nome, biografia, nacionalidade, data_nascimento } = req.body;
        
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

        res.json({ message: 'Autor cadastrado com sucesso', id: result.insertId });
    } catch (error) {
        console.error("Erro ao cadastrar autor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.put("/editar-autor/:id", isAdmin, async (req, res) => {
    try {
        const { nome, biografia, nacionalidade, data_nascimento } = req.body;
        
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
        console.error("Erro ao editar autor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.delete("/remover-usuario/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute("DELETE FROM usuarios WHERE id = ?", [req.params.id]);
        res.send("Usuário removido com sucesso");
    } catch (error) {
        console.error("Erro ao remover usuário:", error);
        res.status(500).send("Erro interno do servidor");
    }
});

router.delete("/remover-professor/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute("DELETE FROM usuarios WHERE id = ? AND tipo = 'professor'", [req.params.id]);
        res.send("Professor removido com sucesso");
    } catch (error) {
        console.error("Erro ao remover professor:", error);
        res.status(500).send("Erro interno do servidor");
    }
});

router.delete("/remover-autor/:id", isAdmin, async (req, res) => {
    try {
        // Verificar se o autor está sendo usado em algum livro
        const [livros] = await req.db.execute('SELECT id FROM livros WHERE id_autor = ?', [req.params.id]);
        if (livros.length > 0) {
            return res.status(400).json({ error: 'Não é possível remover autor que possui livros cadastrados' });
        }

        await req.db.execute('DELETE FROM autores WHERE id = ?', [req.params.id]);
        res.json({ message: 'Autor removido com sucesso' });
    } catch (error) {
        console.error("Erro ao remover autor:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.delete("/remover-livro/:id", isAdmin, async (req, res) => {
    try {
        await req.db.execute('DELETE FROM livros WHERE id = ?', [req.params.id]);
        res.json({ message: 'Livro removido com sucesso' });
    } catch (error) {
        console.error("Erro ao remover livro:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.put("/editar-usuario/:id", isAdmin, async (req, res) => {
    try {
        const { nome, email, numero_matricula } = req.body;
        
        await req.db.execute(
            "UPDATE usuarios SET nome = ?, email = ?, numero_matricula = ? WHERE id = ?",
            [nome, email, numero_matricula, req.params.id]
        );

        res.send("Usuário atualizado com sucesso");
    } catch (error) {
        console.error("Erro ao editar usuário:", error);
        res.status(500).send("Erro interno do servidor");
    }
});

module.exports = router;
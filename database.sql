-- Criar database
CREATE DATABASE IF NOT EXISTS biblioteca_virtual;
USE biblioteca_virtual;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    tipo ENUM('admin', 'professor', 'estudante', 'visitante') NOT NULL DEFAULT 'estudante',
    numero_matricula VARCHAR(100),
    numero_agente VARCHAR(100),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de autores
CREATE TABLE IF NOT EXISTS autores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    biografia TEXT,
    nacionalidade VARCHAR(100),
    data_nascimento DATE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de livros
CREATE TABLE IF NOT EXISTS livros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    id_autor INT,
    id_categoria INT,
    id_professor INT NOT NULL,
    descricao TEXT,
    arquivo_pdf VARCHAR(255) NOT NULL,
    capa VARCHAR(255),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_autor) REFERENCES autores(id) ON DELETE SET NULL,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id) ON DELETE SET NULL,
    FOREIGN KEY (id_professor) REFERENCES usuarios(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS recuperacao_senha (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expira_em DATETIME NOT NULL,
    usado TINYINT(1) DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token_hash),
    INDEX idx_usuario (id_usuario),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Inserir categorias padrão
INSERT IGNORE INTO categorias (nome, descricao) VALUES
('Ciência', 'Livros de ciência e tecnologia'),
('Literatura', 'Obras literárias e ficção'),
('História', 'Livros de história e geografia'),
('Matemática', 'Livros de matemática e cálculo'),
('Filosofia', 'Obras filosóficas e pensamento crítico'),
('Artes', 'Livros sobre artes e cultura');




-- Inserir admin padrão (senha: 123456)
INSERT IGNORE INTO usuarios (nome, email, senha_hash, tipo, numero_agente) VALUES
('Administrador', 'admin@biblioteca.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin', 'ADM001');

-- Inserir alguns autores de exemplo
INSERT IGNORE INTO autores (nome, nacionalidade, data_nascimento) VALUES
('Machado de Assis', 'Brasileira', '1839-06-21'),
('Clarice Lispector', 'Brasileira', '1920-12-10'),
('Jorge Amado', 'Brasileira', '1912-08-10'),
('José Saramago', 'Portuguesa', '1922-11-16');


-- script.sql (ATUALIZADO)
USE biblioteca_virtual;

-- Inserir categorias padrão (com INSERT IGNORE para evitar duplicatas)
INSERT IGNORE INTO categorias (id, nome, descricao) VALUES
(1, 'Ciência', 'Livros de ciência e tecnologia'),
(2, 'Literatura', 'Obras literárias e ficção'),
(3, 'História', 'Livros de história e geografia'),
(4, 'Matemática', 'Livros de matemática e cálculo'),
(5, 'Filosofia', 'Obras filosóficas e pensamento crítico'),
(6, 'Artes', 'Livros sobre artes e cultura'),
(7, 'Educação', 'Livros didáticos e educacionais'),
(8, 'Tecnologia', 'Livros sobre tecnologia e programação'),
(9, 'Saúde', 'Livros de medicina e saúde'),
(10, 'Negócios', 'Livros de administração e negócios');

-- Verificar se as categorias foram inseridas
SELECT * FROM categorias;
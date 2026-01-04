const fs = require("fs");
const path = require("path");

// Lista de pastas a serem criadas
const pastas = [
  "public",
  "public/css",
  "public/js",
  "public/img",
  "routes",
  "views",
  "views/admin",
  "views/user",
  "views/professor",
  "controllers",
  "models"
];

// Função para criar pastas
function criarPastas() {
  pastas.forEach((pasta) => {
    const dir = path.join(__dirname, pasta);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Pasta criada: ${pasta}`);
    } else {
      console.log(`✔ Pasta já existe: ${pasta}`);
    }
  });

  // Criar arquivos vazios
  const arquivosVazios = [
    "routes/admin.js",
    "routes/user.js",
    "routes/professor.js",
    "routes/auth.js",

    "controllers/adminController.js",
    "controllers/userController.js",
    "controllers/professorController.js",

    "models/livrosModel.js",
    "models/usuariosModel.js",

    "app.js",
    "database.sql"
  ];

  arquivosVazios.forEach((arquivo) => {
    const filePath = path.join(__dirname, arquivo);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
      console.log(`📝 Arquivo criado: ${arquivo}`);
    } else {
      console.log(`✔ Arquivo já existe: ${arquivo}`);
    }
  });
}

criarPastas();

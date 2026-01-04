const bcrypt = require("bcrypt");

(async () => {
    const senha = "admin123"; // sua senha desejada
    const hash = await bcrypt.hash(senha, 10);
    console.log("Hash gerada:", hash);
})();

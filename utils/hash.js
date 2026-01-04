const crypto = require('crypto');

function simpleHash(password) {
    if (!password) {
        throw new Error('Password cannot be empty');
    }
    return crypto.createHash('sha256').update(password).digest('hex');
}

function simpleCompare(password, hash) {
    if (!password || !hash) {
        return false;
    }
    return simpleHash(password) === hash;
}

// Teste básico para verificar se está funcionando
console.log('🔐 Hash module loaded');
console.log('Test hash for "123456":', simpleHash('123456'));

module.exports = { simpleHash, simpleCompare };
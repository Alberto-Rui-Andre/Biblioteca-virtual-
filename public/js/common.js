// Funções comuns para todas as páginas

// Logout unificado
async function fazerLogout() {
    if (confirm('Deseja realmente sair?')) {
        try {
            const response = await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                window.location.href = '/auth/login';
                return;
            }
            
            window.location.href = '/auth/logout';
            
        } catch (error) {
            console.error('Erro no logout:', error);
            window.location.href = '/auth/logout';
        }
    }
}

// Carregar informações do usuário
async function carregarUserInfo() {
    try {
        const response = await fetch('/api/user-info');
        if (response.ok) {
            const user = await response.json();
            const userNameElement = document.getElementById('user-welcome') || 
                                   document.getElementById('user-name') || 
                                   document.getElementById('sidebar-user-name');
            if (userNameElement) {
                userNameElement.textContent = user.nome || 'Usuário';
            }
            return user;
        }
    } catch (error) {
        console.log('Erro ao carregar informações do usuário');
    }
    return null;
}
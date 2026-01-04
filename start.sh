#!/data/data/com.termux/files/usr/bin/bash
# start.sh — inicializa MariaDB e servidor Node da Biblioteca Virtual no Termux

PROJECT_DIR="/storage/emulated/0/Biblioteca Virtual"
APP_FILE="app.js"

# Função para verificar se MariaDB está rodando
is_mariadb_running() {
  pgrep -a -f "mysqld" >/dev/null 2>&1
}

# Inicia MariaDB se não estiver rodando
if ! is_mariadb_running; then
  echo "Iniciando MariaDB..."
  mysqld_safe --datadir=/data/data/com.termux/files/usr/var/lib/mysql >/dev/null 2>&1 &
fi

# Espera 5 segundos para MariaDB subir
echo "Aguardando MariaDB..."
sleep 5
echo "MariaDB está pronto."

# Evita iniciar Node duas vezes
if pgrep -f "node .*${APP_FILE}" >/dev/null 2>&1; then
  echo "Servidor Node já está rodando."
  exit 0
fi

# Entra na pasta do projeto
cd "$PROJECT_DIR" || exit 1

# Inicia Node em background e cria log
nohup node "$APP_FILE" > "$PROJECT_DIR/biblioteca.log" 2>&1 &
echo $! > "$PROJECT_DIR/biblioteca.pid"
echo "Servidor Node iniciado (PID $(cat "$PROJECT_DIR/biblioteca.pid"))"

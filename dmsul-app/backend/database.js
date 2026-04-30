// Usa o módulo SQLite nativo do Node.js 22+ (disponível em Node 24)
const { DatabaseSync } = require('node:sqlite')
const path = require('path')

const db = new DatabaseSync(path.join(__dirname, 'dmsul.db'))

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fretes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origem TEXT NOT NULL,
      destino TEXT NOT NULL,
      notas_fiscais TEXT NOT NULL,
      descricao TEXT DEFAULT '',
      data_frete TEXT NOT NULL,
      placa_caminhao TEXT NOT NULL,
      valor_frete REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `)
  console.log('✅ Banco de dados inicializado!')
}

module.exports = { db, initDatabase }

const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const fretesRouter = require('./routes/fretes');
const relatorioRouter = require('./routes/relatorio');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDatabase();

app.use('/api/fretes', fretesRouter);
app.use('/api/relatorio', relatorioRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DM SUL API funcionando!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor DM SUL rodando em http://localhost:${PORT}`);
  console.log(`📱 Para acesso pelo celular, use o IP da sua rede local`);
});

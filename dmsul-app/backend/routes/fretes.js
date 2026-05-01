const express = require('express');
const router = express.Router();
const { db } = require('../database');

const CNPJS_FRETE = [
  '05.648.120/0003-85',
  '05.648.120/0004-66',
  '05.648.120/0002-02',
];

// GET /api/fretes - Lista fretes com filtros
router.get('/', (req, res) => {
  try {
    const { placa, data_inicio, data_fim, search } = req.query;
    let query = 'SELECT * FROM fretes WHERE 1=1';
    const params = [];

    if (placa) { query += ' AND placa_caminhao = ?'; params.push(placa); }
    if (data_inicio) { query += ' AND data_frete >= ?'; params.push(data_inicio); }
    if (data_fim) { query += ' AND data_frete <= ?'; params.push(data_fim); }
    if (search) {
      query += ' AND (origem LIKE ? OR destino LIKE ? OR placa_caminhao LIKE ? OR cnpj_frete LIKE ?)';
      const t = `%${search}%`;
      params.push(t, t, t, t);
    }

    query += ' ORDER BY data_frete DESC, id DESC';
    const fretes = db.prepare(query).all(...params);
    res.json(fretes.map(f => ({ ...f, notas_fiscais: JSON.parse(f.notas_fiscais) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fretes/meta/stats - Estatísticas gerais
router.get('/meta/stats', (req, res) => {
  try {
    const hoje = new Date();
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const dia = hoje.getDate();
    const ano = hoje.getFullYear();
    const mesN = String(hoje.getMonth() + 1).padStart(2, '0');

    let qInicio, qFim;
    if (dia <= 15) {
      qInicio = `${ano}-${mesN}-01`;
      qFim = `${ano}-${mesN}-15`;
    } else {
      const ultimo = new Date(ano, hoje.getMonth() + 1, 0).getDate();
      qInicio = `${ano}-${mesN}-16`;
      qFim = `${ano}-${mesN}-${ultimo}`;
    }

    const totalMes = db.prepare(
      "SELECT COUNT(*) as total, COALESCE(SUM(valor_frete),0) as valor FROM fretes WHERE data_frete LIKE ?"
    ).get(`${mes}%`);

    const totalGeral = db.prepare(
      "SELECT COUNT(*) as total, COALESCE(SUM(valor_frete),0) as valor FROM fretes"
    ).get();

    const quinzena = db.prepare(
      "SELECT COUNT(*) as total, COALESCE(SUM(valor_frete),0) as valor FROM fretes WHERE data_frete >= ? AND data_frete <= ?"
    ).get(qInicio, qFim);

    const placas = db.prepare(
      "SELECT COUNT(DISTINCT placa_caminhao) as total FROM fretes"
    ).get();

    res.json({ totalMes, totalGeral, quinzena, placas: placas.total, quinzenaPeriodo: { inicio: qInicio, fim: qFim } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fretes/meta/placas - Lista placas únicas
router.get('/meta/placas', (req, res) => {
  try {
    const placas = db.prepare('SELECT DISTINCT placa_caminhao FROM fretes ORDER BY placa_caminhao').all();
    res.json(placas.map(p => p.placa_caminhao));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fretes/:id - Busca frete por ID
router.get('/:id', (req, res) => {
  try {
    const frete = db.prepare('SELECT * FROM fretes WHERE id = ?').get(req.params.id);
    if (!frete) return res.status(404).json({ error: 'Frete não encontrado' });
    res.json({ ...frete, notas_fiscais: JSON.parse(frete.notas_fiscais) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fretes - Cria novo frete
router.post('/', (req, res) => {
  try {
    const { origem, destino, notas_fiscais, descricao, data_frete, placa_caminhao, valor_frete, cnpj_frete } = req.body;

    if (!origem || !destino || !notas_fiscais || !data_frete || !placa_caminhao || valor_frete === undefined || !cnpj_frete) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    }

    if (!CNPJS_FRETE.includes(cnpj_frete)) {
      return res.status(400).json({ error: 'CNPJ do frete inválido' });
    }

    const nfs = Array.isArray(notas_fiscais) ? notas_fiscais : [notas_fiscais];
    const stmt = db.prepare(`
      INSERT INTO fretes (origem, destino, notas_fiscais, descricao, data_frete, placa_caminhao, valor_frete, cnpj_frete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      origem.trim(),
      destino.trim(),
      JSON.stringify(nfs.filter(n => n.trim())),
      (descricao || '').trim(),
      data_frete,
      placa_caminhao.toUpperCase().trim(),
      parseFloat(valor_frete),
      cnpj_frete
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Frete cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fretes/:id - Remove frete
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM fretes WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Frete não encontrado' });
    res.json({ message: 'Frete removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

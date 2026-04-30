const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { db } = require('../database');

// Busca fretes de um período
function getFretesNoPeriodo(inicio, fim) {
  return db.prepare(`
    SELECT * FROM fretes WHERE data_frete >= ? AND data_frete <= ?
    ORDER BY data_frete ASC, placa_caminhao ASC
  `).all(inicio, fim).map(f => ({ ...f, notas_fiscais: JSON.parse(f.notas_fiscais) }));
}

// GET /api/relatorio/periodo - Dados do relatório (JSON)
router.get('/periodo', (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: 'Informe data_inicio e data_fim' });

    const fretes = getFretesNoPeriodo(data_inicio, data_fim);
    const total = fretes.reduce((s, f) => s + f.valor_frete, 0);

    const porCaminhao = {};
    fretes.forEach(f => {
      if (!porCaminhao[f.placa_caminhao]) porCaminhao[f.placa_caminhao] = { total: 0, quantidade: 0 };
      porCaminhao[f.placa_caminhao].total += f.valor_frete;
      porCaminhao[f.placa_caminhao].quantidade++;
    });

    res.json({ fretes, total, porCaminhao, periodo: { data_inicio, data_fim } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/relatorio/excel - Gera e baixa planilha Excel
router.get('/excel', (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: 'Informe data_inicio e data_fim' });

    const fretes = getFretesNoPeriodo(data_inicio, data_fim);
    const total = fretes.reduce((s, f) => s + f.valor_frete, 0);

    // Planilha 1: Fretes detalhados
    const dados = fretes.map((f, i) => ({
      '#': i + 1,
      'Data': f.data_frete,
      'Origem': f.origem,
      'Destino': f.destino,
      'Notas Fiscais': f.notas_fiscais.join(', '),
      'Placa': f.placa_caminhao,
      'Descrição': f.descricao || '-',
      'Valor (R$)': f.valor_frete
    }));

    // Linha de total
    dados.push({ '#': '', 'Data': '', 'Origem': '', 'Destino': '', 'Notas Fiscais': '', 'Placa': '', 'Descrição': 'TOTAL GERAL', 'Valor (R$)': total });

    const ws1 = XLSX.utils.json_to_sheet(dados);
    ws1['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 22 }, { wch: 22 },
      { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 14 }
    ];

    // Planilha 2: Resumo por caminhão
    const porCaminhao = {};
    fretes.forEach(f => {
      if (!porCaminhao[f.placa_caminhao]) porCaminhao[f.placa_caminhao] = { total: 0, quantidade: 0 };
      porCaminhao[f.placa_caminhao].total += f.valor_frete;
      porCaminhao[f.placa_caminhao].quantidade++;
    });

    const resumo = Object.entries(porCaminhao).map(([placa, info]) => ({
      'Placa': placa,
      'Qtd Fretes': info.quantidade,
      'Total (R$)': info.total
    }));

    const ws2 = XLSX.utils.json_to_sheet(resumo);
    ws2['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Fretes Detalhados');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Caminhão');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `DMSUL_Fretes_${data_inicio}_a_${data_fim}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/relatorio/quinzenal - Gera Excel da quinzena atual
router.get('/quinzenal', (req, res) => {
  const hoje = new Date();
  const dia = hoje.getDate();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  let inicio, fim;

  if (dia <= 15) {
    inicio = `${ano}-${mes}-01`;
    fim = `${ano}-${mes}-15`;
  } else {
    const ultimo = new Date(ano, hoje.getMonth() + 1, 0).getDate();
    inicio = `${ano}-${mes}-16`;
    fim = `${ano}-${mes}-${String(ultimo).padStart(2, '0')}`;
  }

  res.redirect(`/api/relatorio/excel?data_inicio=${inicio}&data_fim=${fim}`);
});

module.exports = router;

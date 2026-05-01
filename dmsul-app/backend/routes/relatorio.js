const express = require('express');
const router = express.Router();
const { db } = require('../database');

const CNPJS_FRETE = [
  '05.648.120/0003-85',
  '05.648.120/0004-66',
  '05.648.120/0002-02',
];

const CLIENTE = 'TABACUM INTERAMERICAN COM. EXP. FUMO LTDA';
const PRESTADOR = 'PRESTADOR: TRANS DM SUL TRANSPORTADORA - CNPJ: 09.643.781/0001-07';

function getFretesNoPeriodo(inicio, fim) {
  return db.prepare(`
    SELECT * FROM fretes WHERE data_frete >= ? AND data_frete <= ?
    ORDER BY cnpj_frete ASC, data_frete ASC, placa_caminhao ASC, id ASC
  `).all(inicio, fim).map(f => ({ ...f, notas_fiscais: JSON.parse(f.notas_fiscais) }));
}

function formatDate(d) {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPeriodoRef(inicio) {
  const [ano, mes, diaInicio] = inicio.split('-').map(Number);
  const meses = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  const quinzena = diaInicio <= 15 ? '1ª QUINZENA' : '2ª QUINZENA';
  return `Ref: ${quinzena} ${meses[mes - 1]} ${ano}`;
}

function cell(value, style = 'Cell', type = 'String', attrs = '') {
  return `<Cell ss:StyleID="${style}"${attrs}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function row(cells, height) {
  const heightAttr = height ? ` ss:Height="${height}"` : '';
  return `<Row${heightAttr}>${cells.join('')}</Row>`;
}

function columns(widths) {
  return widths.map(width => `<Column ss:Width="${width}"/>`).join('');
}

function expandFretes(fretes) {
  return fretes.map(frete => ({
    ...frete,
    nota_fiscal: frete.notas_fiscais.length ? frete.notas_fiscais.join(', ') : 'S/Nº',
  }));
}

function detalheWorksheet(cnpj, fretes, periodoRef, index) {
  const linhas = expandFretes(fretes);
  const total = linhas.reduce((sum, f) => sum + Number(f.valor_frete || 0), 0);
  const rows = [
    row([cell('', 'RedBar', 'String', ' ss:MergeAcross="5"')], 14),
    row([cell(`${CLIENTE} - CNPJ: ${cnpj}`, 'TopText', 'String', ' ss:MergeAcross="5"')], 18),
    row([cell(PRESTADOR, 'TopText', 'String', ' ss:MergeAcross="5"')], 18),
    row([cell(periodoRef, 'TitleBlue', 'String', ' ss:MergeAcross="5"')], 28),
    row([
      cell('QUANT.', 'HeaderBlue'),
      cell('DATA', 'HeaderBlue'),
      cell('Nº NOTA FISCAL', 'HeaderBlue'),
      cell('VALOR FRETE', 'HeaderBlue'),
      cell('DESCRIÇÃO', 'HeaderBlue'),
      cell('CAMINHÃO', 'HeaderBlue'),
    ], 20),
  ];

  linhas.forEach((f, rowIndex) => {
    rows.push(row([
      cell(rowIndex + 1, 'Cell', 'Number'),
      cell(formatDate(f.data_frete), 'Cell'),
      cell(f.nota_fiscal, 'Cell'),
      cell(formatCurrency(Number(f.valor_frete || 0)), 'Cell'),
      cell(f.descricao || '-', 'CellLeft'),
      cell(f.placa_caminhao || '-', 'Cell'),
    ], 16));
  });

  rows.push(row([
    cell('', 'Blank'),
    cell('', 'Blank'),
    cell('TOTAL', 'Total'),
    cell(formatCurrency(total), 'Total'),
    cell('', 'Blank'),
    cell('', 'Blank'),
  ], 18));

  return `
    <Worksheet ss:Name="CNPJ ${index + 1}">
      <Table>
        ${columns([54, 90, 118, 102, 360, 96])}
        ${rows.join('')}
      </Table>
    </Worksheet>`;
}

function resumoWorksheet(fretes) {
  const porCnpj = {};
  CNPJS_FRETE.forEach(cnpj => {
    porCnpj[cnpj] = { quantidade: 0, total: 0 };
  });

  fretes.forEach(f => {
    if (!porCnpj[f.cnpj_frete]) porCnpj[f.cnpj_frete] = { quantidade: 0, total: 0 };
    porCnpj[f.cnpj_frete].quantidade++;
    porCnpj[f.cnpj_frete].total += Number(f.valor_frete || 0);
  });

  const totalGeral = Object.values(porCnpj).reduce((sum, item) => sum + item.total, 0);
  const quantidadeGeral = Object.values(porCnpj).reduce((sum, item) => sum + item.quantidade, 0);
  const rows = [
    row([
      cell('', 'ResumoHeader'),
      cell('CNPJ', 'ResumoHeader'),
      cell('Quant. viagens', 'ResumoHeader'),
      cell('Soma', 'ResumoHeader'),
      cell('Valor', 'ResumoHeader'),
      cell('Valor Total', 'ResumoHeader'),
    ], 20),
  ];

  Object.entries(porCnpj).forEach(([cnpj, item]) => {
    rows.push(row([
      cell('DM SUL', 'ResumoCellLeft'),
      cell(cnpj, 'ResumoCell'),
      cell(item.quantidade, 'ResumoCell', 'Number'),
      cell(item.quantidade, 'ResumoCell', 'Number'),
      cell(formatCurrency(item.total), 'ResumoCell'),
      cell('', 'ResumoCell'),
    ], 20));
  });

  rows.push(row([
    cell('', 'ResumoTotal'),
    cell('TOTAL', 'ResumoTotal'),
    cell(quantidadeGeral, 'ResumoTotal', 'Number'),
    cell(quantidadeGeral, 'ResumoTotal', 'Number'),
    cell(formatCurrency(totalGeral), 'ResumoTotal'),
    cell(formatCurrency(totalGeral), 'ResumoTotal'),
  ], 24));

  return `
    <Worksheet ss:Name="Resumo">
      <Table>
        ${columns([92, 170, 110, 84, 110, 120])}
        ${rows.join('')}
      </Table>
    </Worksheet>`;
}

function buildExcelXml(fretes, periodoRef) {
  const detailSheets = CNPJS_FRETE.map((cnpj, index) =>
    detalheWorksheet(cnpj, fretes.filter(f => f.cnpj_frete === cnpj), periodoRef, index)
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="RedBar"><Interior ss:Color="#E00000" ss:Pattern="Solid"/></Style>
    <Style ss:ID="TopText">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
    </Style>
    <Style ss:ID="TitleBlue">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B4378" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
    </Style>
    <Style ss:ID="HeaderBlue">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B4378" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Cell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="CellLeft">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Total">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Blank"/>
    <Style ss:ID="ResumoHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
      </Borders>
    </Style>
    <Style ss:ID="ResumoCell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
      </Borders>
    </Style>
    <Style ss:ID="ResumoCellLeft">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
      </Borders>
    </Style>
    <Style ss:ID="ResumoTotal">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>
      </Borders>
    </Style>
  </Styles>
  ${detailSheets}
  ${resumoWorksheet(fretes)}
</Workbook>`;
}

// GET /api/relatorio/periodo - Dados do relatorio (JSON)
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

// GET /api/relatorio/excel - Gera e baixa planilha Excel estilizada
router.get('/excel', (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: 'Informe data_inicio e data_fim' });

    const fretes = getFretesNoPeriodo(data_inicio, data_fim);
    const xml = buildExcelXml(fretes, getPeriodoRef(data_inicio));
    const filename = `DMSUL_Fretes_${data_inicio}_a_${data_fim}.xls`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(xml, 'utf8'));
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

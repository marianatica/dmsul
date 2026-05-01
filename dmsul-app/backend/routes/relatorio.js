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
    SELECT * FROM fretes
    WHERE data_frete >= ? AND data_frete <= ?
    ORDER BY cnpj_frete ASC, data_frete ASC, id ASC
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

function getPeriodoRef(inicio, fim) {
  const [ano, mes, diaInicio] = inicio.split('-').map(Number);
  const meses = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const quinzena = diaInicio <= 15 ? '1ª QUINZENA' : '2ª QUINZENA';
  if (fim) {
    const [anoFim, mesFim] = fim.split('-').map(Number);
    if (mesFim !== mes || anoFim !== ano) return `Ref: ${formatDate(inicio)} a ${formatDate(fim)}`;
  }
  return `Ref: ${quinzena} ${meses[mes - 1]} ${ano}`;
}

function cell(value, style, type, mergeAcross) {
  style = style || 'Cell'; type = type || 'String'; mergeAcross = mergeAcross || 0;
  const merge = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : '';
  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function emptyCell(style) {
  return `<Cell ss:StyleID="${style || 'Blank'}"/>`;
}

function row(cells, height) {
  const h = height ? ` ss:Height="${height}"` : '';
  return `<Row${h}>${cells.join('')}</Row>`;
}

function columns(widths) {
  return widths.map(w => `<Column ss:Width="${w}"/>`).join('');
}

function detalheWorksheet(cnpj, fretesDoCnpj, periodoRef, sheetName) {
  const total = fretesDoCnpj.reduce((s, f) => s + Number(f.valor_frete || 0), 0);

  const rows = [
    row([cell('', 'RedBar', 'String', 5)], 10),
    row([cell(`${CLIENTE} - CNPJ: ${cnpj}`, 'TopTextCenter', 'String', 5)], 18),
    row([cell(PRESTADOR, 'TopTextCenter', 'String', 5)], 18),
    row([cell(periodoRef, 'TitleBlue', 'String', 5)], 30),
    row([
      cell('QUANT.', 'HeaderBlue'),
      cell('DATA', 'HeaderBlue'),
      cell('Nº NOTA FISCAL', 'HeaderBlue'),
      cell('VALOR FRETE', 'HeaderBlue'),
      cell('DESCRIÇÃO', 'HeaderBlue'),
      cell('CAMINHÃO', 'HeaderBlue'),
    ], 22),
  ];

  if (fretesDoCnpj.length === 0) {
    rows.push(row([emptyCell('Cell'), cell('Nenhum frete neste período', 'CellLeft', 'String', 4), emptyCell('Cell')], 18));
  } else {
    fretesDoCnpj.forEach((f, idx) => {
      const nfs = Array.isArray(f.notas_fiscais) ? f.notas_fiscais.join(', ') : (f.notas_fiscais || '');
      const nota = nfs.trim() || 'S/Nº';
      rows.push(row([
        cell(idx + 1, 'Cell', 'Number'),
        cell(formatDate(f.data_frete), 'Cell'),
        cell(nota, 'Cell'),
        cell(formatCurrency(Number(f.valor_frete || 0)), 'Cell'),
        cell(f.descricao || '-', 'CellLeft'),
        cell(f.placa_caminhao || '-', 'Cell'),
      ], 18));
    });
  }

  rows.push(row([
    emptyCell('Blank'), emptyCell('Blank'),
    cell('TOTAL', 'Total'),
    cell(formatCurrency(total), 'Total'),
    emptyCell('Blank'), emptyCell('Blank'),
  ], 20));

  return `<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${columns([54, 90, 118, 110, 340, 90])}${rows.join('')}</Table></Worksheet>`;
}

function resumoWorksheet(fretes, periodoRef) {
  const porCnpj = {};
  CNPJS_FRETE.forEach(cnpj => { porCnpj[cnpj] = { quantidade: 0, total: 0 }; });
  fretes.forEach(f => {
    if (!porCnpj[f.cnpj_frete]) porCnpj[f.cnpj_frete] = { quantidade: 0, total: 0 };
    porCnpj[f.cnpj_frete].quantidade++;
    porCnpj[f.cnpj_frete].total += Number(f.valor_frete || 0);
  });
  const totalGeral = Object.values(porCnpj).reduce((s, v) => s + v.total, 0);
  const qtdGeral = Object.values(porCnpj).reduce((s, v) => s + v.quantidade, 0);

  const rows = [
    row([cell('', 'RedBar', 'String', 3)], 10),
    row([cell(`RESUMO GERAL · ${periodoRef}`, 'TitleBlue', 'String', 3)], 30),
    row([cell('EMPRESA','HeaderBlue'), cell('CNPJ','HeaderBlue'), cell('QTD. FRETES','HeaderBlue'), cell('VALOR TOTAL','HeaderBlue')], 22),
  ];
  CNPJS_FRETE.forEach(cnpj => {
    const item = porCnpj[cnpj];
    rows.push(row([cell('DM SUL','ResumoCellLeft'), cell(cnpj,'ResumoCell'), cell(item.quantidade,'ResumoCell','Number'), cell(formatCurrency(item.total),'ResumoCell')], 20));
  });
  rows.push(row([emptyCell('ResumoTotal'), cell('TOTAL GERAL','ResumoTotal'), cell(qtdGeral,'ResumoTotal','Number'), cell(formatCurrency(totalGeral),'ResumoTotal')], 24));

  return `<Worksheet ss:Name="Resumo"><Table>${columns([110, 180, 120, 130])}${rows.join('')}</Table></Worksheet>`;
}

const STYLES = `<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
<Style ss:ID="RedBar"><Interior ss:Color="#CC0000" ss:Pattern="Solid"/></Style>
<Style ss:ID="TopTextCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/></Style>
<Style ss:ID="TitleBlue"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="13" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B4378" ss:Pattern="Solid"/></Style>
<Style ss:ID="HeaderBlue"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B4378" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
<Style ss:ID="Cell"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/></Borders></Style>
<Style ss:ID="CellLeft"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/></Borders></Style>
<Style ss:ID="Total"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders></Style>
<Style ss:ID="Blank"/>
<Style ss:ID="ResumoCell"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/></Borders></Style>
<Style ss:ID="ResumoCellLeft"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/></Borders></Style>
<Style ss:ID="ResumoTotal"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B4378" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders></Style>
</Styles>`;

function buildExcelXml(fretes, periodoRef) {
  const detailSheets = CNPJS_FRETE.map((cnpj, i) =>
    detalheWorksheet(cnpj, fretes.filter(f => f.cnpj_frete === cnpj), periodoRef, `CNPJ ${i + 1}`)
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${STYLES}${detailSheets}${resumoWorksheet(fretes, periodoRef)}</Workbook>`;
}

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
    const porCnpj = {};
    CNPJS_FRETE.forEach(cnpj => { porCnpj[cnpj] = { total: 0, quantidade: 0, fretes: [] }; });
    fretes.forEach(f => {
      if (!porCnpj[f.cnpj_frete]) porCnpj[f.cnpj_frete] = { total: 0, quantidade: 0, fretes: [] };
      porCnpj[f.cnpj_frete].total += f.valor_frete;
      porCnpj[f.cnpj_frete].quantidade++;
      porCnpj[f.cnpj_frete].fretes.push(f);
    });
    res.json({ fretes, total, porCaminhao, porCnpj, periodo: { data_inicio, data_fim } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/excel', (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    if (!data_inicio || !data_fim) return res.status(400).json({ error: 'Informe data_inicio e data_fim' });
    const fretes = getFretesNoPeriodo(data_inicio, data_fim);
    const periodoRef = getPeriodoRef(data_inicio, data_fim);
    const xml = buildExcelXml(fretes, periodoRef);
    const filename = `DMSUL_Fretes_${data_inicio}_a_${data_fim}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(xml, 'utf8'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/quinzenal', (req, res) => {
  const hoje = new Date();
  const dia = hoje.getDate();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ultimo = new Date(ano, hoje.getMonth() + 1, 0).getDate();
  const inicio = dia <= 15 ? `${ano}-${mes}-01` : `${ano}-${mes}-16`;
  const fim = dia <= 15 ? `${ano}-${mes}-15` : `${ano}-${mes}-${String(ultimo).padStart(2, '0')}`;
  res.redirect(`/api/relatorio/excel?data_inicio=${inicio}&data_fim=${fim}`);
});

module.exports = router;
import { useState } from 'react'
import axios from 'axios'

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function getQuinzenas() {
  const hoje = new Date()
  const dia = hoje.getDate()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()

  const q = []

  // Quinzena atual
  if (dia <= 15) {
    q.push({ inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-15`, label: `1ª Quinzena (01–15/${mes}/${ano})` })
  } else {
    q.push({ inicio: `${ano}-${mes}-16`, fim: `${ano}-${mes}-${ultimoDia}`, label: `2ª Quinzena (16–${ultimoDia}/${mes}/${ano})` })
  }

  // Quinzena anterior
  if (dia <= 15) {
    const anterior = new Date(ano, hoje.getMonth() - 1 + 1, 0)
    const aUltimo = anterior.getDate()
    const aMes = String(anterior.getMonth() + 1).padStart(2, '0')
    const aAno = anterior.getFullYear()
    q.push({ inicio: `${aAno}-${aMes}-16`, fim: `${aAno}-${aMes}-${aUltimo}`, label: `2ª Quinzena anterior (16–${aUltimo}/${aMes})` })
  } else {
    q.push({ inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-15`, label: `1ª Quinzena (01–15/${mes}/${ano})` })
  }

  // Mês atual
  q.push({ inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${ultimoDia}`, label: `Mês atual (${mes}/${ano})` })

  return q
}

export default function Relatorios() {
  const hoje = new Date().toISOString().split('T')[0]
  const primeiroDia = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })()
  const [inicio, setInicio] = useState(primeiroDia)
  const [fim, setFim] = useState(hoje)
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [baixando, setBaixando] = useState(false)

  const quinzenas = getQuinzenas()

  async function buscar() {
    if (!inicio || !fim) return
    setLoading(true)
    try {
      const res = await axios.get('/api/relatorio/periodo', { params: { data_inicio: inicio, data_fim: fim } })
      setDados(res.data)
    } catch (e) {
      alert('Erro ao buscar relatório')
    } finally {
      setLoading(false)
    }
  }

  async function baixarExcel() {
    setBaixando(true)
    try {
      const res = await axios.get('/api/relatorio/excel', {
        params: { data_inicio: inicio, data_fim: fim },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `DMSUL_Fretes_${inicio}_a_${fim}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Erro ao gerar Excel')
    } finally {
      setBaixando(false)
    }
  }

  function aplicarPeriodo(q) {
    setInicio(q.inicio)
    setFim(q.fim)
    setDados(null)
  }

  return (
    <div className="page">
      {/* Atalhos */}
      <div style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>⚡ Atalhos de período</div>
        <div className="period-chips">
          {quinzenas.map((q, i) => (
            <button key={i} className="filter-chip" onClick={() => aplicarPeriodo(q)}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Período personalizado */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          📅 Período personalizado
        </div>
        <div className="date-row" style={{ marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">De</label>
            <input className="form-input" type="date" value={inicio} onChange={e => { setInicio(e.target.value); setDados(null) }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Até</label>
            <input className="form-input" type="date" value={fim} onChange={e => { setFim(e.target.value); setDados(null) }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? '⏳ Buscando...' : '🔍 Gerar Relatório'}
        </button>
      </div>

      {/* Resultado */}
      {dados && (
        <>
          {/* Total */}
          <div className="summary-box">
            <div className="total-label">Total do período · {formatDate(inicio)} a {formatDate(fim)}</div>
            <div className="total-value">{formatCurrency(dados.total)}</div>
            <div className="total-count">{dados.fretes.length} frete{dados.fretes.length !== 1 ? 's' : ''} registrados</div>
          </div>

          {/* Download Excel */}
          <button
            className="btn btn-red"
            style={{ marginBottom: 16 }}
            onClick={baixarExcel}
            disabled={baixando}
          >
            {baixando ? '⏳ Gerando planilha...' : '📥 Baixar Excel (.xlsx)'}
          </button>

          {/* Por caminhão */}
          {Object.keys(dados.porCaminhao).length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Resumo por caminhão</div>
              {Object.entries(dados.porCaminhao).map(([placa, info]) => (
                <div className="caminhao-row" key={placa}>
                  <div>
                    <div className="placa">
                      <span className="badge primary" style={{ fontSize: 13 }}>🚛 {placa}</span>
                    </div>
                    <div className="info">{info.quantidade} frete{info.quantidade !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="valor">{formatCurrency(info.total)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Lista */}
          <div className="section-header" style={{ marginTop: 16 }}>
            <span className="section-title">Fretes no período</span>
          </div>

          {dados.fretes.length === 0 ? (
            <div className="empty">
              <div className="emoji">📭</div>
              <p>Nenhum frete neste período</p>
            </div>
          ) : (
            dados.fretes.map(f => (
              <div className="frete-card" key={f.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="meta" style={{ margin: 0 }}>
                    <span className="badge primary">🚛 {f.placa_caminhao}</span>
                    <span className="badge">📅 {formatDate(f.data_frete)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                  {f.descricao || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Sem descrição</span>}
                </div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  {f.notas_fiscais.map((nf, i) => <span className="badge" key={i} style={{ marginRight: 4 }}>NF: {nf}</span>)}
                </div>
                <div className="valor">{formatCurrency(f.valor_frete)}</div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}

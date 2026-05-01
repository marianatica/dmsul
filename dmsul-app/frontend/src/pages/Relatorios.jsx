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

  if (dia <= 15) {
    q.push({ inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-15`, label: `1ª Quinzena (01-15/${mes}/${ano})` })
    const anterior = new Date(ano, hoje.getMonth(), 0)
    const aUlt = anterior.getDate()
    const aMes = String(anterior.getMonth() + 1).padStart(2, '0')
    const aAno = anterior.getFullYear()
    q.push({ inicio: `${aAno}-${aMes}-16`, fim: `${aAno}-${aMes}-${aUlt}`, label: `2ª Quinzena anterior (16-${aUlt}/${aMes})` })
  } else {
    q.push({ inicio: `${ano}-${mes}-16`, fim: `${ano}-${mes}-${ultimoDia}`, label: `2ª Quinzena (16-${ultimoDia}/${mes}/${ano})` })
    q.push({ inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-15`, label: `1ª Quinzena (01-15/${mes}/${ano})` })
  }
  q.push({ inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${ultimoDia}`, label: `Mês atual (${mes}/${ano})` })
  return q
}

const CNPJS_FRETE = [
  '05.648.120/0003-85',
  '05.648.120/0004-66',
  '05.648.120/0002-02',
]

export default function Relatorios() {
  const hoje = new Date().toISOString().split('T')[0]
  const primeiroDia = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })()
  const [inicio, setInicio] = useState(primeiroDia)
  const [fim, setFim] = useState(hoje)
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [cnpjExpandido, setCnpjExpandido] = useState(null)

  const quinzenas = getQuinzenas()

  async function buscar() {
    if (!inicio || !fim) return
    setLoading(true)
    setDados(null)
    try {
      const res = await axios.get('/api/relatorio/periodo', { params: { data_inicio: inicio, data_fim: fim } })
      setDados(res.data)
      const primeiro = CNPJS_FRETE.find(c => res.data.porCnpj?.[c]?.quantidade > 0)
      setCnpjExpandido(primeiro || null)
    } catch {
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
      a.download = `DMSUL_Fretes_${inicio}_a_${fim}.xls`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro ao gerar Excel')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className="page">
      {/* Atalhos */}
      <div style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Atalhos de período</div>
        <div className="period-chips">
          {quinzenas.map((q, i) => (
            <button key={i} className="filter-chip" onClick={() => { setInicio(q.inicio); setFim(q.fim); setDados(null) }}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Período personalizado */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Período personalizado</div>
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
          {loading ? 'Buscando...' : 'Gerar Relatório'}
        </button>
      </div>

      {dados && (
        <>
          {/* Resumo total */}
          <div className="summary-box">
            <div className="total-label">Total · {formatDate(inicio)} a {formatDate(fim)}</div>
            <div className="total-value">{formatCurrency(dados.total)}</div>
            <div className="total-count">{dados.fretes.length} frete{dados.fretes.length !== 1 ? 's' : ''}</div>
          </div>

          {/* Excel */}
          <button className="btn btn-red" style={{ marginBottom: 16 }} onClick={baixarExcel} disabled={baixando}>
            {baixando ? 'Gerando planilha...' : '⬇ Baixar Excel (.xls)'}
          </button>

          {/* Resumo por CNPJ */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Resumo por CNPJ</div>
            {CNPJS_FRETE.map(cnpj => {
              const info = dados.porCnpj?.[cnpj] || { total: 0, quantidade: 0 }
              return (
                <div key={cnpj} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{cnpj}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{info.quantidade} frete{info.quantidade !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: info.total > 0 ? 'var(--success)' : 'var(--text3)' }}>
                    {formatCurrency(info.total)}
                  </div>
                </div>
              )
            })}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>TOTAL GERAL</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(dados.total)}</div>
            </div>
          </div>

          {/* Fretes agrupados por CNPJ — expansível */}
          <div className="section-header" style={{ marginBottom: 10 }}>
            <span className="section-title">Fretes por CNPJ</span>
          </div>

          {CNPJS_FRETE.map(cnpj => {
            const info = dados.porCnpj?.[cnpj] || { total: 0, quantidade: 0, fretes: [] }
            const aberto = cnpjExpandido === cnpj
            return (
              <div key={cnpj} style={{ marginBottom: 8 }}>
                <div
                  onClick={() => setCnpjExpandido(aberto ? null : cnpj)}
                  style={{
                    background: aberto ? 'var(--primary-light)' : 'var(--card)',
                    border: `1.5px solid ${aberto ? 'rgba(18,50,122,0.25)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{cnpj}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {info.quantidade} frete{info.quantidade !== 1 ? 's' : ''} · {formatCurrency(info.total)}
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: 'var(--text3)', transform: aberto ? 'rotate(180deg)' : 'none', transition: '0.2s', lineHeight: 1 }}>▾</span>
                </div>

                {aberto && (
                  <div style={{ marginTop: 4 }}>
                    {info.fretes.length === 0 ? (
                      <div className="empty" style={{ padding: '20px 16px' }}>
                        <p>Nenhum frete neste CNPJ no período</p>
                      </div>
                    ) : info.fretes.map(f => (
                      <div className="frete-card" key={f.id} style={{ marginBottom: 8 }}>
                        <div style={{ display:'flex', marginBottom: 8 }}>
                          <div className="meta" style={{ margin: 0 }}>
                            <span className="badge primary">Placa: {f.placa_caminhao}</span>
                            <span className="badge">Data: {formatDate(f.data_frete)}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                          {f.descricao || <span style={{ color:'var(--text3)', fontStyle:'italic' }}>Sem descrição</span>}
                        </div>
                        <div style={{ fontSize: 12, marginBottom: 8 }}>
                          {f.notas_fiscais.map((nf, i) => <span className="badge" key={i} style={{ marginRight: 4 }}>NF: {nf}</span>)}
                        </div>
                        <div className="valor">{formatCurrency(f.valor_frete)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
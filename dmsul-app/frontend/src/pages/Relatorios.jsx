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
  } else {
    q.push({ inicio: `${ano}-${mes}-16`, fim: `${ano}-${mes}-${ultimoDia}`, label: `2ª Quinzena (16-${ultimoDia}/${mes}/${ano})` })
  }

  if (dia <= 15) {
    const anterior = new Date(ano, hoje.getMonth(), 0)
    const aUltimo = anterior.getDate()
    const aMes = String(anterior.getMonth() + 1).padStart(2, '0')
    const aAno = anterior.getFullYear()
    q.push({ inicio: `${aAno}-${aMes}-16`, fim: `${aAno}-${aMes}-${aUltimo}`, label: `2ª Quinzena anterior (16-${aUltimo}/${aMes})` })
  } else {
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
      // Expande o primeiro CNPJ que tiver fretes por padrão
      const primeiro = CNPJS_FRETE.find(c => res.data.porCnpj?.[c]?.quantidade > 0)
      setCnpjExpandido(primeiro || null)
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
      a.download = `DMSUL_Fretes_${inicio}_a_${fim}.xls`
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
      {/* Atalhos de período */}
      <div style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Atalhos de período</div>
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
          Período personalizado
        </div>
        <div className="date-row" style={{ marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">De</label>
            <input className="form-input" type="date" value={inicio}
              onChange={e => { setInicio(e.target.value); setDados(null) }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Até</label>
            <input className="form-input" type="date" value={fim}
              onChange={e => { setFim(e.target.value); setDados(null) }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? 'Buscando...' : 'Gerar Relatório'}
        </button>
      </div>

      {/* Resultados */}
      {dados && (
        <>
          {/* Resumo total */}
          <div className="summary-box">
            <div className="total-label">Total do período · {formatDate(inicio)} a {formatDate(fim)}</div>
            <div className="total-value">{formatCurrency(dados.total)}</div>
            <div className="total-count">{dados.fretes.length} frete{dados.fretes.length !== 1 ? 's' : ''} registrados</div>
          </div>

          {/* Botão Excel */}
          <button
            className="btn btn-red"
            style={{ marginBottom: 16 }}
            onClick={baixarExcel}
            disabled={baixando}
          >
            {baixando ? 'Gerando planilha...' : '⬇ Baixar Excel (.xls)'}
          </button>

          {/* Resumo por CNPJ */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 14 }}>Resumo por CNPJ</div>
            {CNPJS_FRETE.map(cnpj => {
              const info = dados.porCnpj?.[cnpj] || { total: 0, quantidade: 0 }
              return (
                <div key={cnpj} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {cnpj}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {info.quantidade} frete{info.quantidade !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>
                    {formatCurrency(info.total)}
                  </div>
                </div>
              )
            })}
            {/* Linha de total geral */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 12,
              marginTop: 4
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>TOTAL GERAL</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(dados.total)}
              </div>
            </div>
          </div>

          {/* Resumo por caminhão */}
          {Object.keys(dados.porCaminhao).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 14 }}>Resumo por caminhão</div>
              {Object.entries(dados.porCaminhao).map(([placa, info]) => (
                <div className="caminhao-row" key={placa}>
                  <div>
                    <div className="placa">
                      <span className="badge primary" style={{ fontSize: 13 }}>Placa: {placa}</span>
                    </div>
                    <div className="info">{info.quantidade} frete{info.quantidade !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="valor">{formatCurrency(info.total)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Fretes por CNPJ — expansível */}
          <div className="section-header" style={{ marginTop: 4, marginBottom: 12 }}>
            <span className="section-title">Fretes por CNPJ</span>
          </div>

          {CNPJS_FRETE.map(cnpj => {
            const info = dados.porCnpj?.[cnpj] || { total: 0, quantidade: 0, fretes: [] }
            const aberto = cnpjExpandido === cnpj
            return (
              <div key={cnpj} style={{ marginBottom: 10 }}>
                {/* Cabeçalho expansível */}
                <div
                  onClick={() => setCnpjExpandido(aberto ? null : cnpj)}
                  style={{
                    background: aberto ? 'var(--primary-light)' : 'var(--card)',
                    border: `1.5px solid ${aberto ? 'rgba(18,50,122,0.25)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {cnpj}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {info.quantidade} frete{info.quantidade !== 1 ? 's' : ''} · {formatCurrency(info.total)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                      {formatCurrency(info.total)}
                    </span>
                    <span style={{
                      fontSize: 18,
                      color: 'var(--text3)',
                      transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: '0.2s',
                      lineHeight: 1,
                    }}>▾</span>
                  </div>
                </div>

                {/* Fretes deste CNPJ */}
                {aberto && (
                  <div style={{ marginTop: 4 }}>
                    {info.fretes.length === 0 ? (
                      <div className="empty" style={{ padding: '24px 16px' }}>
                        <p>Nenhum frete neste CNPJ para o período</p>
                      </div>
                    ) : (
                      info.fretes.map(f => (
                        <div className="frete-card" key={f.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div className="meta" style={{ margin: 0 }}>
                              <span className="badge primary">Placa: {f.placa_caminhao}</span>
                              <span className="badge">Data: {formatDate(f.data_frete)}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                            {f.descricao || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Sem descrição</span>}
                          </div>
                          <div style={{ fontSize: 12, marginBottom: 8 }}>
                            {f.notas_fiscais.map((nf, i) => (
                              <span className="badge" key={i} style={{ marginRight: 4 }}>NF: {nf}</span>
                            ))}
                          </div>
                          <div className="valor">{formatCurrency(f.valor_frete)}</div>
                        </div>
                      ))
                    )}
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
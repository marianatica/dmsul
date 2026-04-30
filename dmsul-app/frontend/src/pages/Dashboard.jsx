import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, fretesRes] = await Promise.all([
          axios.get('/api/fretes/meta/stats'),
          axios.get('/api/fretes')
        ])
        setStats(statsRes.data)
        setRecentes(fretesRes.data.slice(0, 5))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="page">
      <div className="loading"><div className="spinner" /><p>Carregando...</p></div>
    </div>
  )

  return (
    <div className="page">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon">🚛</div>
          <div className="label">Fretes este mês</div>
          <div className="value primary">{stats?.totalMes?.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="icon">💰</div>
          <div className="label">Valor este mês</div>
          <div className="value accent">{formatCurrency(stats?.totalMes?.valor)}</div>
        </div>
        <div className="stat-card">
          <div className="icon">📅</div>
          <div className="label">Fretes quinzena</div>
          <div className="value primary">{stats?.quinzena?.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="icon">🚌</div>
          <div className="label">Caminhões ativos</div>
          <div className="value primary">{stats?.placas || 0}</div>
        </div>
      </div>

      {/* Quinzena banner */}
      {stats?.quinzenaPeriodo && (
        <div className="quinzena-banner">
          <div>
            <div className="q-label">Quinzena atual</div>
            <div className="q-dates">
              {formatDate(stats.quinzenaPeriodo.inicio)} → {formatDate(stats.quinzenaPeriodo.fim)}
            </div>
          </div>
          <div>
            <div className="q-valor">{formatCurrency(stats?.quinzena?.valor)}</div>
            <div className="q-count">{stats?.quinzena?.total || 0} frete{stats?.quinzena?.total !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary" style={{ fontSize: 14, padding: '13px' }} onClick={() => navigate('/novo')}>
          ➕ Novo Frete
        </button>
        <button className="btn btn-red" style={{ fontSize: 14, padding: '13px' }} onClick={() => navigate('/relatorios')}>
          📁 Relatório
        </button>
      </div>

      {/* Fretes recentes */}
      <div className="section-header">
        <span className="section-title">Fretes Recentes</span>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => navigate('/historico')}>
          Ver todos
        </button>
      </div>

      {recentes.length === 0 ? (
        <div className="empty">
          <div className="emoji">🚛</div>
          <p>Nenhum frete registrado ainda</p>
          <small>Toque em "Novo Frete" para começar</small>
        </div>
      ) : (
        recentes.map(f => (
          <div className="frete-card" key={f.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="meta" style={{ margin: 0 }}>
                <span className="badge primary">🚛 {f.placa_caminhao}</span>
                <span className="badge">📅 {formatDate(f.data_frete)}</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, minHeight: 18 }}>
              {f.descricao || <span style={{ color: 'var(--text3)' }}>Sem descrição</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              NF: {f.notas_fiscais.join(', ')}
            </div>
            <div className="valor">{formatCurrency(f.valor_frete)}</div>
          </div>
        ))
      )}
    </div>
  )
}

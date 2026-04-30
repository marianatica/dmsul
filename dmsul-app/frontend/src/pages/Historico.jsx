import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function Historico() {
  const [fretes, setFretes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [placas, setPlacas] = useState([])
  const [filtroPlaca, setFiltroPlaca] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (filtroPlaca) params.placa = filtroPlaca
      const res = await axios.get('/api/fretes', { params })
      setFretes(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, filtroPlaca])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    axios.get('/api/fretes/meta/placas').then(r => setPlacas(r.data)).catch(() => {})
  }, [])

  async function deleteFrete(id) {
    try {
      await axios.delete(`/api/fretes/${id}`)
      setConfirmDelete(null)
      load()
    } catch (e) {
      alert('Erro ao remover frete')
    }
  }

  return (
    <div className="page">
      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por descrição ou placa..."
        />
      </div>

      {/* Filtro por placa */}
      {placas.length > 0 && (
        <div className="filters">
          <span className={`filter-chip${!filtroPlaca ? ' active' : ''}`} onClick={() => setFiltroPlaca('')}>
            Todos
          </span>
          {placas.map(p => (
            <span
              key={p}
              className={`filter-chip${filtroPlaca === p ? ' active' : ''}`}
              onClick={() => setFiltroPlaca(p === filtroPlaca ? '' : p)}
            >🚛 {p}</span>
          ))}
        </div>
      )}

      {/* Count + total */}
      {!loading && (
        <div className="section-header">
          <span className="section-title">{fretes.length} frete{fretes.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700 }}>
            {formatCurrency(fretes.reduce((s, f) => s + f.valor_frete, 0))}
          </span>
        </div>
      )}

      {/* Modal confirmação exclusão */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16
        }}>
          <div className="card" style={{ margin: 0, width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Remover frete?</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" style={{ flex: 1, padding: '14px' }} onClick={() => deleteFrete(confirmDelete)}>Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="loading"><div className="spinner" /><p>Carregando...</p></div>
      ) : fretes.length === 0 ? (
        <div className="empty">
          <div className="emoji">📋</div>
          <p>Nenhum frete encontrado</p>
          <small>{search ? 'Tente outro termo de busca' : 'Cadastre o primeiro frete'}</small>
        </div>
      ) : (
        fretes.map(f => (
          <div className="frete-card" key={f.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="meta" style={{ margin: 0, flex: 1 }}>
                <span className="badge primary">🚛 {f.placa_caminhao}</span>
                <span className="badge">📅 {formatDate(f.data_frete)}</span>
              </div>
            </div>

            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6, minHeight: 20 }}>
              {f.descricao || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Sem descrição</span>}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              {f.notas_fiscais.map((nf, i) => (
                <span className="badge" key={i} style={{ marginRight: 4 }}>NF: {nf}</span>
              ))}
            </div>

            <div className="footer">
              <div className="valor">{formatCurrency(f.valor_frete)}</div>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(f.id)}>
                🗑 Remover
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

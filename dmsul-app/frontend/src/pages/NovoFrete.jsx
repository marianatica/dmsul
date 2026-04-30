import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

function Toast({ msg, type }) {
  return msg ? <div className={`toast show ${type}`}>{msg}</div> : null
}

export default function NovoFrete() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const [form, setForm] = useState({
    descricao: '',
    data_frete: new Date().toISOString().split('T')[0],
    placa_caminhao: '',
    valor_frete: '',
  })
  const [notas, setNotas] = useState([''])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: '' }), 3000)
  }

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'placa_caminhao') {
      setForm(p => ({ ...p, placa_caminhao: value.toUpperCase() }))
    } else {
      setForm(p => ({ ...p, [name]: value }))
    }
  }

  function addNota() { setNotas(p => [...p, '']) }
  function removeNota(i) { setNotas(p => p.filter((_, idx) => idx !== i)) }
  function updateNota(i, v) { setNotas(p => p.map((n, idx) => idx === i ? v : n)) }

  async function handleSubmit(e) {
    e.preventDefault()
    const notasValidas = notas.filter(n => n.trim())
    if (notasValidas.length === 0) {
      showToast('Adicione pelo menos uma nota fiscal', 'error')
      return
    }
    if (!form.valor_frete || parseFloat(form.valor_frete) <= 0) {
      showToast('Informe um valor de frete válido', 'error')
      return
    }

    setLoading(true)
    try {
      await axios.post('/api/fretes', {
        ...form,
        notas_fiscais: notasValidas,
        valor_frete: parseFloat(String(form.valor_frete).replace(',', '.')),
        // Frete interno — origem/destino não são necessários
        origem: 'Interno',
        destino: 'Interno',
      })
      showToast('✅ Frete cadastrado com sucesso!')
      setTimeout(() => navigate('/historico'), 1500)
    } catch (err) {
      showToast(err.response?.data?.error || 'Erro ao cadastrar frete', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <Toast {...toast} />

      {/* Card de instrução */}
      <div className="card" style={{ borderLeft: '4px solid var(--primary)', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
          Preencha os dados do frete e clique em <strong>Cadastrar</strong>. Você pode incluir múltiplas notas fiscais no mesmo frete.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Notas Fiscais */}
        <div className="form-group">
          <label className="form-label">Notas Fiscais <span className="required">*</span></label>
          <div className="nf-list">
            {notas.map((nf, i) => (
              <div className="nf-row" key={i}>
                <input
                  className="form-input"
                  value={nf}
                  onChange={e => updateNota(i, e.target.value)}
                  placeholder={`Número da nota fiscal ${i + 1}`}
                />
                {notas.length > 1 && (
                  <button type="button" className="btn-remove-nf" onClick={() => removeNota(i)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-add-nf" onClick={addNota}>
              ＋ Adicionar outra nota fiscal
            </button>
          </div>
        </div>

        {/* Descrição */}
        <div className="form-group">
          <label className="form-label">Descrição da viagem</label>
          <textarea
            className="form-textarea"
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            placeholder="Ex: Entrega de mercadoria, cliente XYZ..."
          />
        </div>

        {/* Data e Placa */}
        <div className="date-row">
          <div className="form-group">
            <label className="form-label">Data do frete <span className="required">*</span></label>
            <input
              className="form-input"
              type="date"
              name="data_frete"
              value={form.data_frete}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Placa do caminhão <span className="required">*</span></label>
            <input
              className="form-input"
              name="placa_caminhao"
              value={form.placa_caminhao}
              onChange={handleChange}
              placeholder="ABC-1234"
              required
              maxLength={8}
            />
          </div>
        </div>

        {/* Valor */}
        <div className="form-group">
          <label className="form-label">Valor do frete (R$) <span className="required">*</span></label>
          <input
            className="form-input"
            type="number"
            name="valor_frete"
            value={form.valor_frete}
            onChange={handleChange}
            placeholder="0,00"
            step="0.01"
            min="0"
            required
            style={{ fontSize: 20, fontWeight: 700 }}
          />
        </div>

        <div style={{ height: 8 }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? '⏳ Salvando...' : '✅ Cadastrar Frete'}
        </button>
      </form>
    </div>
  )
}

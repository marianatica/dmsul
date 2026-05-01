import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const CNPJS_FRETE = [
  '05.648.120/0003-85',
  '05.648.120/0004-66',
  '05.648.120/0002-02',
]

const PLACAS = [
  'IKP-7231',
  'IDM-8652',
]

const DESCRICOES = [
  'Transporte de Tabaco Cortado Blend',
  '(Retorno) Transporte de Tabaco Diversos',
  'Transporte de Contentor / Pó de Lâmina (GLT)',
  'Transporte de Contentor / Pó de Talo (GLT)',
  '(Retorno) Transporte de Embalagens Novas',
  'Transporte de Contentor (GLT)',
  '(Retorno) Transporte de Embalagens Usadas',
  '(Retorno) Transporte de Embalagens Novas',
]

function Toast({ msg, type }) {
  return msg ? <div className={`toast show ${type}`}>{msg}</div> : null
}

export default function NovoFrete() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: '' })

  const [usarValorPadrao, setUsarValorPadrao] = useState(true)
  const [usarOutraDescricao, setUsarOutraDescricao] = useState(false)

  const [form, setForm] = useState({
    descricao: '',
    data_frete: new Date().toISOString().split('T')[0],
    placa_caminhao: '',
    valor_frete: '',
    cnpj_frete: '',
  })

  const [notas, setNotas] = useState([''])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: '' }), 3000)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
  }

  function addNota() {
    setNotas(p => [...p, ''])
  }

  function removeNota(i) {
    setNotas(p => p.filter((_, idx) => idx !== i))
  }

  function updateNota(i, v) {
    setNotas(p => p.map((n, idx) => (idx === i ? v : n)))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const notasValidas = notas.filter(n => n.trim())

    if (notasValidas.length === 0) {
      showToast('Adicione pelo menos uma nota fiscal', 'error')
      return
    }

    if (!CNPJS_FRETE.includes(form.cnpj_frete)) {
      showToast('Selecione um CNPJ válido', 'error')
      return
    }

    if (!PLACAS.includes(form.placa_caminhao)) {
      showToast('Selecione uma placa válida', 'error')
      return
    }

    if (!form.descricao) {
      showToast('Selecione ou informe uma descrição', 'error')
      return
    }

    const valorFinal = usarValorPadrao
      ? 140
      : parseFloat(String(form.valor_frete).replace(',', '.'))

    if (!valorFinal || valorFinal <= 0) {
      showToast('Informe um valor de frete válido', 'error')
      return
    }

    setLoading(true)

    try {
      await axios.post('/api/fretes', {
        ...form,
        notas_fiscais: notasValidas,
        valor_frete: valorFinal,
        origem: 'Interno',
        destino: 'Interno',
      })

      showToast('Frete cadastrado com sucesso')
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

      <form onSubmit={handleSubmit}>

        {/* NOTAS FISCAIS */}
        <div className="form-group">
          <label className="form-label">
            Notas Fiscais <span className="required">*</span>
          </label>

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
                  <button type="button" className="btn-remove-nf" onClick={() => removeNota(i)}>
                    Remover
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="btn-add-nf" onClick={addNota}>
              Adicionar outra nota fiscal
            </button>
          </div>
        </div>

        {/* DESCRIÇÃO */}
        <div className="form-group">
          <label className="form-label">Descrição da viagem</label>

          <select
            className="form-select"
            value={usarOutraDescricao ? 'OUTRO' : form.descricao}
            onChange={(e) => {
              if (e.target.value === 'OUTRO') {
                setUsarOutraDescricao(true)
                setForm(p => ({ ...p, descricao: '' }))
              } else {
                setUsarOutraDescricao(false)
                setForm(p => ({ ...p, descricao: e.target.value }))
              }
            }}
          >
            <option value="">Selecione uma descrição</option>

            {DESCRICOES.map(desc => (
              <option key={desc} value={desc}>{desc}</option>
            ))}

            <option value="OUTRO">Outra descrição</option>
          </select>

          {usarOutraDescricao && (
            <textarea
              className="form-textarea"
              name="descricao"
              value={form.descricao}
              onChange={handleChange}
              placeholder="Digite uma descrição personalizada..."
              style={{ marginTop: 8 }}
            />
          )}
        </div>

        {/* DATA + PLACA */}
        <div className="date-row">
          <div className="form-group">
            <label className="form-label">
              Data do frete <span className="required">*</span>
            </label>

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
            <label className="form-label">
              Placa do caminhão <span className="required">*</span>
            </label>

            <select
              className="form-select"
              name="placa_caminhao"
              value={form.placa_caminhao}
              onChange={handleChange}
              required
            >
              <option value="">Selecione a placa</option>
              {PLACAS.map(placa => (
                <option key={placa} value={placa}>{placa}</option>
              ))}
            </select>
          </div>
        </div>

        {/* VALOR */}
        <div className="form-group">
          <label className="form-label">
            Valor do frete (R$) <span className="required">*</span>
          </label>

          <input
            className="form-input"
            type={usarValorPadrao ? "text" : "number"}
            name="valor_frete"
            value={usarValorPadrao ? "140,00" : form.valor_frete}
            onChange={handleChange}
            disabled={usarValorPadrao}
            style={{
              fontSize: 20,
              fontWeight: 700,
              backgroundColor: "#f5f5f5",
              color: "#666",
              cursor: usarValorPadrao ? "not-allowed" : "text"
            }}
          />

          <button
            type="button"
            className={`btn ${usarValorPadrao ? 'btn-outline' : 'btn-primary'}`}
            style={{ marginTop: 8, width: '100%' }}
            onClick={() => {
              setUsarValorPadrao(false)
              setForm(p => ({ ...p, valor_frete: '' }))
            }}
          >
            {usarValorPadrao ? 'Usar outro valor' : 'Valor personalizado'}
          </button>
        </div>

        {/* CNPJ */}
        <div className="form-group">
          <label className="form-label">
            CNPJ do frete <span className="required">*</span>
          </label>

          <select
            className="form-select"
            name="cnpj_frete"
            value={form.cnpj_frete}
            onChange={handleChange}
            required
          >
            <option value="">Selecione um CNPJ</option>
            {CNPJS_FRETE.map(cnpj => (
              <option key={cnpj} value={cnpj}>{cnpj}</option>
            ))}
          </select>
        </div>

        <div style={{ height: 8 }} />

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar Frete'}
        </button>
      </form>
    </div>
  )
}
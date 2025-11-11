import React, { useEffect, useRef, useState } from 'react'

type Counter = {
  id: number
  name: string
  value: number
  image?: string | null
  maxValue?: number | null
}

const STORAGE_KEY = 'counters_data'
const THEME_KEY = 'app_theme'

function loadCounters(): Counter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error(e)
    return []
  }
}

function saveCounters(counters: Counter[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counters))
  } catch (e) {
    console.error('保存失败', e)
  }
}

async function compressImage(file: File, maxWidth = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('转换失败'))
            const r = new FileReader()
            r.onload = () => resolve(r.result as string)
            r.onerror = reject
            r.readAsDataURL(blob)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function App(): JSX.Element {
  const [counters, setCounters] = useState<Counter[]>(() => loadCounters())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null)
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_KEY) || 'dark')
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [currentImageUploadIndex, setCurrentImageUploadIndex] = useState<number | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => saveCounters(counters), [counters])

  function openModal(index: number | null = null) {
    setEditingIndex(index)
    setModalOpen(true)
  }

  function closeModal() {
    setEditingIndex(null)
    setModalOpen(false)
  }

  async function handleAddOrEdit(form: { name: string; maxValue?: number | null; imageFile?: File | null }) {
    if (editingIndex === null) {
      let imageData: string | undefined = undefined
      if (form.imageFile) imageData = await compressImage(form.imageFile)
      const newCounter: Counter = {
        id: Date.now(),
        name: form.name,
        value: 0,
        image: imageData || null,
        maxValue: form.maxValue ?? null
      }
      setCounters((s) => [...s, newCounter])
    } else {
      // compress image (if any) before updating state
      let maybeImage: string | undefined = undefined
      if (form.imageFile) {
        maybeImage = await compressImage(form.imageFile)
      }
      setCounters((s) => {
        const copy = [...s]
        const c = copy[editingIndex]
        if (!c) return s
        c.name = form.name
        if (maybeImage) c.image = maybeImage
        c.maxValue = form.maxValue ?? null
        copy[editingIndex] = c
        return copy
      })
    }
    closeModal()
  }

  function increase(index: number) {
    setCounters((s) => {
      const copy = [...s]
      const c = copy[index]
      c.value++
      if (c.maxValue && c.value === c.maxValue) {
        setAlert({ title: '达到最大阈值！', message: `计数器 "${c.name}" 已达到最大阈值 ${c.maxValue}。` })
      }
      return copy
    })
  }

  function decrease(index: number) {
    setCounters((s) => {
      const copy = [...s]
      if (copy[index].value > 0) copy[index].value--
      return copy
    })
  }

  function resetCounter(index: number) {
    setCounters((s) => {
      const copy = [...s]
      copy[index].value = 0
      return copy
    })
  }

  function deleteCounter(index: number) {
    if (!confirm('确定要删除这个计数器吗？')) return
    setCounters((s) => s.filter((_, i) => i !== index))
  }

  function openImagePicker(index: number) {
    setCurrentImageUploadIndex(index)
    imageInputRef.current?.click()
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0 || currentImageUploadIndex === null) return
    const file = e.target.files[0]
    if (!file.type.startsWith('image/')) { window.alert('请选择图片文件'); return }
    try {
      const data = await compressImage(file)
      setCounters((s) => {
        const copy = [...s]
        copy[currentImageUploadIndex!] = { ...copy[currentImageUploadIndex!], image: data }
        return copy
      })
    } catch (err) {
      window.alert('图片处理失败: ' + (err as Error).message)
    }
    e.currentTarget.value = ''
    setCurrentImageUploadIndex(null)
  }

  function resetAll() {
    if (!confirm(`确定要重置所有 ${counters.length} 个计数器吗？`)) return
    setCounters((s) => s.map(c => ({ ...c, value: 0 })))
  }

  function openBatchModal() { setBatchOpen(true) }
  function closeBatchModal() { setBatchOpen(false) }

  function applyBatchThreshold(val: number | null) {
    setCounters((s) => s.map(c => ({ ...c, maxValue: val })))
    closeBatchModal()
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>自动统计计数器</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--muted)', marginRight: 6 }}>主题</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="dark">深色</option>
              <option value="light">亮色</option>
              <option value="blue">蓝色</option>
              <option value="green">绿色</option>
              <option value="purple">紫色</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ color: 'var(--muted)' }}>总计: </span>
              <strong style={{ color: 'var(--accent)', fontSize: 18 }}>{counters.reduce((a, b) => a + b.value, 0)}</strong>
            </div>
            <button className="btn btn-danger" onClick={resetAll} disabled={counters.length===0}>重置全部</button>
            <button className="btn" onClick={openBatchModal} disabled={counters.length===0}>批量修改阈值</button>
            <button className="btn btn-primary" onClick={() => openModal(null)}>+ 添加计数器</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {counters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            <div style={{ fontSize: 48 }}>📊</div>
            <div>还没有计数器，点击上方按钮添加一个吧！</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {counters.map((counter, idx) => (
              <div key={counter.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{counter.name}</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="counter-delete" onClick={() => openModal(idx)} title="编辑">✎</button>
                    <button className="counter-delete" onClick={() => deleteCounter(idx)} title="删除">×</button>
                  </div>
                </div>

                <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', border: '1px solid var(--border)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }} onClick={() => openImagePicker(idx)}>
                  {counter.image ? <img src={counter.image} alt={counter.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: 'var(--muted)' }}>点击选择图片</div>}
                  <button style={{ position: 'absolute', top: 6, right: 6 }} className="image-upload-btn" onClick={(e) => { e.stopPropagation(); openImagePicker(idx) }}>更换</button>
                </div>

                <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', textAlign: 'center', marginTop: 16 }}>{counter.value}</div>

                <div style={{ marginTop: 8, textAlign: 'center' }}>{counter.maxValue ? <div style={{ fontSize: 12, color: counter.maxValue && counter.value >= counter.maxValue ? 'var(--danger)' : 'var(--muted)' }}>{counter.maxValue && counter.value >= counter.maxValue ? '⚠️ ' : ''}最大阈值: {counter.maxValue}</div> : null}</div>

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button className="btn btn-decrease" onClick={() => decrease(idx)} disabled={counter.value===0}>−</button>
                  <button className="btn btn-reset" onClick={() => resetCounter(idx)}>重置</button>
                  <button className="btn btn-increase" onClick={() => increase(idx)}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for image upload */}
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelected} />

      {/* Modal for add/edit (simple implementation using native prompt for speed) */}
      {modalOpen && (
        <CounterModal
          initial={editingIndex !== null ? counters[editingIndex] : undefined}
          onClose={closeModal}
          onSave={handleAddOrEdit}
        />
      )}

      {batchOpen && (
        <BatchModal counters={counters} onClose={closeBatchModal} onApply={applyBatchThreshold} />
      )}

      {alert && (
        <AlertModal title={alert.title} message={alert.message} onClose={() => setAlert(null)} />
      )}
    </div>
  )
}

function CounterModal({ initial, onClose, onSave }: { initial?: Counter; onClose: () => void; onSave: (data: { name: string; maxValue?: number | null; imageFile?: File | null }) => void }) {
  const [name, setName] = useState(initial?.name || '')
  const [maxValue, setMaxValue] = useState<string>(initial?.maxValue ? String(initial.maxValue) : '')
  const [file, setFile] = useState<File | null>(null)

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const mv = maxValue.trim() ? parseInt(maxValue) : null
  if (mv !== null && (isNaN(mv) || mv < 1)) { window.alert('阈值必须是大于0的整数'); return }
  if (!name.trim()) { window.alert('请输入计数器名称'); return }
    onSave({ name: name.trim(), maxValue: mv, imageFile: file })
  }

  return (
    <div className="modal active" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <form className="modal-content" onSubmit={submit} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{initial ? '编辑计数器' : '添加计数器'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--muted)' }}>名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--muted)' }}>图片（可选）</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--muted)' }}>最大阈值（可选）</label>
          <input value={maxValue} onChange={(e) => setMaxValue(e.target.value)} className="form-input" />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  )
}

function BatchModal({ counters, onClose, onApply }: { counters: Counter[]; onClose: () => void; onApply: (val: number | null) => void }) {
  const [val, setVal] = useState<string>('')
  return (
    <div className="modal active" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div className="modal-content" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>批量修改阈值</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--muted)' }}>统一设置为</label>
          <input value={val} onChange={(e) => setVal(e.target.value)} className="form-input" placeholder="留空表示清除所有阈值" />
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
          {counters.map(c => (
            <div key={c.id} style={{ padding: 8, marginBottom: 8, background: 'var(--card-bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>当前值: {c.value} | {c.maxValue ? `阈值: ${c.maxValue}` : '无阈值'}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onApply(val.trim() ? parseInt(val) : null)}>应用</button>
        </div>
      </div>
    </div>
  )
}

function AlertModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="alert-modal active" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div className="alert-content" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>{title}</div>
        <div style={{ color: 'var(--muted)', marginBottom: 16 }}>{message}</div>
        <button className="btn btn-primary" onClick={onClose}>知道了</button>
      </div>
    </div>
  )
}

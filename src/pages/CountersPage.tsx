import React, { useEffect, useRef, useState } from 'react'
import { Button, Select, Modal, Input, InputNumber, Upload, Form, message, Image as AntdImage } from 'antd'
import { useNavigate } from 'react-router-dom'
import './CountersPage.css'
import type { UploadFile } from 'antd/es/upload/interface'
import { Category, Counter, Persisted, loadState, saveState } from '../lib/state'
const THEME_KEY = 'app_theme'

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

export default function CountersPage(): JSX.Element {
  const persisted = loadState()
  const [categories, setCategories] = useState<Category[]>(() => persisted.categories.length ? persisted.categories : [{ id: Date.now(), name: '默认' }])
  const [counters, setCounters] = useState<Counter[]>(() => persisted.counters.length ? persisted.counters : [])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(() => persisted.categories.length ? persisted.categories[0].id : (persisted.counters[0]?.categoryId ?? (Date.now())))
  const [editingCounterId, setEditingCounterId] = useState<number | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_KEY) || 'dark')
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [currentImageUploadId, setCurrentImageUploadId] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => saveState({ categories, counters }), [categories, counters])

  useEffect(() => {
    function onStateChanged() {
      const p = loadState()
      setCategories(p.categories.length ? p.categories : [{ id: Date.now(), name: '默认' }])
      setCounters(p.counters)
      if (p.categories.length) setSelectedCategoryId(p.categories[0].id)
    }
    window.addEventListener('appStateChanged', onStateChanged)
    return () => window.removeEventListener('appStateChanged', onStateChanged)
  }, [])

  function openModal(counterId: number | null = null) {
    setEditingCounterId(counterId)
    setModalOpen(true)
  }

  function closeModal() {
    setEditingCounterId(null)
    setModalOpen(false)
  }

  async function handleAddOrEdit(form: { name: string; maxValue?: number | null; imageFile?: File | null }) {
    if (editingCounterId === null) {
      if (!selectedCategoryId) {
        Modal.confirm({ title: '请先选择或创建一个大类', content: '当前没有可用大类，是否现在创建一个？', okText: '创建', cancelText: '取消', onOk() { setCategoryModalOpen(true) } })
        return
      }
      let imageData: string | undefined = undefined
      if (form.imageFile) imageData = await compressImage(form.imageFile)
      const newCounter: Counter = {
        id: Date.now(),
        name: form.name,
        value: 0,
        image: imageData || null,
        maxValue: form.maxValue ?? null,
        categoryId: selectedCategoryId
      }
      setCounters((s) => [...s, newCounter])
    } else {
      let maybeImage: string | undefined = undefined
      if (form.imageFile) {
        maybeImage = await compressImage(form.imageFile)
      }
      setCounters((s) => s.map(c => c.id === editingCounterId ? { ...c, name: form.name, image: maybeImage ?? c.image, maxValue: form.maxValue ?? null } : c))
    }
    closeModal()
  }

  function increase(counterId: number) {
    setCounters((s) => {
      const next = s.map(c => c.id === counterId ? { ...c, value: c.value + 1 } : c)
      const changed = next.find(x => x.id === counterId)
      if (changed && changed.maxValue && changed.value === changed.maxValue) {
        // 延后展示，确保只调用一次
        setTimeout(() => {
          Modal.info({ title: '达到最大阈值！', content: <div>{`计数器 "${changed.name}" 已达到最大阈值 ${changed.maxValue}。`}</div>, okText: '知道了' })
        }, 0)
      }
      return next
    })
  }

  function decrease(counterId: number) {
    setCounters((s) => s.map(c => c.id === counterId ? { ...c, value: Math.max(0, c.value - 1) } : c))
  }

  function resetCounter(counterId: number) {
    setCounters((s) => s.map(c => c.id === counterId ? { ...c, value: 0 } : c))
  }

  function deleteCounter(counterId: number) {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个计数器吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk() {
        setCounters((s) => s.filter((c) => c.id !== counterId))
      }
    })
  }

  function openImagePicker(counterId: number) {
    setCurrentImageUploadId(counterId)
    imageInputRef.current?.click()
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
  if (!e.target.files || e.target.files.length === 0 || currentImageUploadId === null) return
    const file = e.target.files[0]
    if (!file.type.startsWith('image/')) { window.alert('请选择图片文件'); return }
    try {
      const data = await compressImage(file)
      setCounters((s) => s.map(c => c.id === currentImageUploadId ? { ...c, image: data } : c))
    } catch (err) {
      window.alert('图片处理失败: ' + (err as Error).message)
    }
    e.currentTarget.value = ''
  setCurrentImageUploadId(null)
  }

  function resetAll() {
    Modal.confirm({
      title: '确认重置',
      content: `确定要重置当前大类下的 ${counters.filter(c=>c.categoryId===selectedCategoryId).length} 个计数器吗？`,
      okText: '重置',
      cancelText: '取消',
      onOk() {
        setCounters((s) => s.map(c => c.categoryId === selectedCategoryId ? { ...c, value: 0 } : c))
      }
    })
  }

  function openBatchModal() { setBatchOpen(true) }
  function closeBatchModal() { setBatchOpen(false) }

  function applyBatchThreshold(val: number | null) {
    setCounters((s) => s.map(c => c.categoryId === selectedCategoryId ? { ...c, maxValue: val } : c))
    closeBatchModal()
  }

  function deleteCategory(catId: number) {
    const cat = categories.find(c => c.id === catId)
    if (!cat) return
    Modal.confirm({
      title: '删除大类',
      content: `删除大类 "${cat.name}" 会同时删除其下所有计数器，确定吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk() {
        const newCats = categories.filter(c => c.id !== catId)
        setCategories(newCats)
        setCounters(s => s.filter(c => c.categoryId !== catId))
        if (newCats.length) setSelectedCategoryId(newCats[0].id)
        else setSelectedCategoryId(0)
      }
    })
  }

  return (
    <div className="cp-container">
      <div className="cp-header">
        <h1 className="cp-title">自动统计计数器</h1>

        <div className="cp-controls">
          <div className="cp-theme">
            <span className="cp-theme-label">大类</span>
            <Select value={selectedCategoryId} onChange={(v) => setSelectedCategoryId(v)} className="cp-select" options={categories.map(c => ({ value: c.id, label: c.name }))} />
            <Button size="small" onClick={() => navigate('/categories')}>管理大类</Button>

            <div style={{ width: 12 }} />
            <span className="cp-theme-label">主题</span>
            <Select value={theme} onChange={(v) => setTheme(v)} className="cp-select" options={[
              { value: 'dark', label: '深色' },
              { value: 'light', label: '亮色' },
              { value: 'blue', label: '蓝色' },
              { value: 'green', label: '绿色' },
              { value: 'purple', label: '紫色' }
            ]} />
          </div>

          <div className="cp-actions">
            <Button type="default" size="middle" onClick={resetAll} disabled={counters.filter(c=>c.categoryId===selectedCategoryId).length===0}>重置全部</Button>
            <Button type="default" size="middle" onClick={openBatchModal} disabled={counters.filter(c=>c.categoryId===selectedCategoryId).length===0}>批量修改阈值</Button>
            <Button type="default" size="middle" onClick={() => openModal(null)} disabled={!selectedCategoryId}>添加计数器</Button>
          </div>
        </div>

        <div className="cp-total">{counters.filter(c=>c.categoryId===selectedCategoryId).reduce((a,b)=>a+b.value,0)}</div>
      </div>

      <div className="cp-body">
        {(() => {
          const visibleCounters = counters.filter(c => c.categoryId === selectedCategoryId)
          if (visibleCounters.length === 0) return (
            <div className="cp-empty">
              <div className="cp-empty-emoji">📊</div>
              <div>还没有计数器，点击上方按钮添加一个吧！</div>
            </div>
          )
          return (
            <div className="cp-grid">
              {visibleCounters.map((counter) => (
                <div key={counter.id} className="cp-card">
                  <div className="cp-card-header">
                    <h3 className="cp-card-title">{counter.name}</h3>
                    <div className="cp-card-controls">
                      <Button type="primary" size="middle" onClick={() => openModal(counter.id)} title="编辑">编辑</Button>
                      <Button type="default" danger size="middle" onClick={() => deleteCounter(counter.id)} title="删除">删除</Button>
                    </div>
                  </div>

                  <div className="cp-avatar-row">
                    <div className="cp-avatar-wrapper">
                      {counter.image ? (
                        <AntdImage src={counter.image} alt={counter.name} className="cp-avatar" preview />
                      ) : (
                        <div onClick={() => openImagePicker(counter.id)} className="cp-avatar-placeholder">点击选择图片</div>
                      )}
                    </div>
                    <Button type="default" size="small" shape="circle" className="cp-change-btn" title="更换图片" onClick={(e) => { e.stopPropagation(); openImagePicker(counter.id) }}>⟳</Button>
                  </div>

                  <div className="cp-value">{counter.value}</div>

                  <div className="cp-threshold">{counter.maxValue ? <div className="cp-threshold-inner">{counter.maxValue && counter.value >= counter.maxValue ? '⚠️ ' : ''}最大阈值: {counter.maxValue}</div> : null}</div>

                  <div className="cp-footer-buttons">
                    <Button type="default" size="middle" onClick={() => decrease(counter.id)} disabled={counter.value===0}>−</Button>
                    <Button type="default" size="middle" onClick={() => resetCounter(counter.id)}>重置</Button>
                    <Button type="default" size="middle" onClick={() => increase(counter.id)}>+</Button>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

  <input ref={imageInputRef} type="file" accept="image/*" className="cp-file-input" onChange={handleImageSelected} />

      {modalOpen && (
        <CounterModal
          initial={editingCounterId !== null ? counters.find(c => c.id === editingCounterId) : undefined}
          onClose={closeModal}
          onSave={handleAddOrEdit}
        />
      )}

      {batchOpen && (
        <BatchModal counters={counters.filter(c => c.categoryId === selectedCategoryId)} onClose={closeBatchModal} onApply={applyBatchThreshold} />
      )}
    </div>
  )
}

function CounterModal({ initial, onClose, onSave }: { initial?: Counter; onClose: () => void; onSave: (data: { name: string; maxValue?: number | null; imageFile?: File | null }) => void }) {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])

  useEffect(() => {
    form.setFieldsValue({ name: initial?.name ?? '', maxValue: initial?.maxValue ?? undefined })
  }, [initial, form])

  function beforeUpload(file: UploadFile) {
    setFileList([file])
    return false
  }

  function handleOk() {
    form.validateFields().then(values => {
      const mv = values.maxValue ?? null
      if (mv !== null && (isNaN(mv) || mv < 1)) { message.error('阈值必须是大于0的整数'); return }
      const file = (fileList[0] as any) ?? null
      onSave({ name: values.name.trim(), maxValue: mv, imageFile: file as File | null })
    }).catch(() => {})
  }

  return (
    <Modal open title={initial ? '编辑计数器' : '添加计数器'} onCancel={onClose} onOk={handleOk} okText="保存" cancelText="取消" width={520} maskClosable={false}>
      <Form form={form} layout="vertical" initialValues={{ name: initial?.name ?? '', maxValue: initial?.maxValue ?? undefined }}>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入计数器名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="图片（可选）">
          <Upload beforeUpload={beforeUpload} fileList={fileList} onRemove={() => setFileList([])} accept="image/*" showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}>
            <Button>选择图片</Button>
          </Upload>
        </Form.Item>
        <Form.Item name="maxValue" label="最大阈值（可选）">
          <InputNumber className="cp-fullwidth" min={1} placeholder="留空表示无阈值" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function BatchModal({ counters, onClose, onApply }: { counters: Counter[]; onClose: () => void; onApply: (val: number | null) => void }) {
  const [val, setVal] = useState<number | null | undefined>(undefined)

  function handleOk() {
    onApply(val === undefined || val === null ? null : val)
  }

  return (
    <Modal open title="批量修改阈值" onCancel={onClose} onOk={handleOk} okText="应用" cancelText="取消" width={620} maskClosable={false}>
      <div className="cp-batch-top">
        <div className="cp-batch-desc">统一设置为</div>
        <InputNumber className="cp-fullwidth" min={1} value={val as number | undefined} onChange={(v) => setVal(v as number | null | undefined)} placeholder="留空表示清除所有阈值" />
      </div>
      <div className="cp-batch-list">
        {counters.map(c => (
          <div key={c.id} className="cp-batch-item">
            <div className="cp-batch-item-name">{c.name}</div>
            <div className="cp-batch-item-sub">当前值: {c.value} | {c.maxValue ? `阈值: ${c.maxValue}` : '无阈值'}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

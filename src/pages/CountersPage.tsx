import React, { useEffect, useRef, useState } from 'react'
import { Button, Select, Modal, Input, InputNumber, Upload, Form, message, Image as AntdImage } from 'antd'
import './CountersPage.css'
import type { UploadFile } from 'antd/es/upload/interface'

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

export default function CountersPage(): JSX.Element {
  const [counters, setCounters] = useState<Counter[]>(() => loadCounters())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
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
    const nextCounters = counters.map((c, i) => i === index ? { ...c, value: c.value + 1 } : c)
    setCounters(nextCounters)
    const changed = nextCounters[index]
    if (changed && changed.maxValue && changed.value === changed.maxValue) {
      Modal.info({
        title: '达到最大阈值！',
        content: <div>{`计数器 "${changed.name}" 已达到最大阈值 ${changed.maxValue}。`}</div>,
        okText: '知道了'
      })
    }
  }

  function decrease(index: number) {
    setCounters((s) => s.map((c, i) => i === index ? { ...c, value: Math.max(0, c.value - 1) } : c))
  }

  function resetCounter(index: number) {
    setCounters((s) => s.map((c, i) => i === index ? { ...c, value: 0 } : c))
  }

  function deleteCounter(index: number) {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个计数器吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk() {
        setCounters((s) => s.filter((_, i) => i !== index))
      }
    })
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
    Modal.confirm({
      title: '确认重置',
      content: `确定要重置所有 ${counters.length} 个计数器吗？`,
      okText: '重置',
      cancelText: '取消',
      onOk() {
        setCounters((s) => s.map(c => ({ ...c, value: 0 })))
      }
    })
  }

  function openBatchModal() { setBatchOpen(true) }
  function closeBatchModal() { setBatchOpen(false) }

  function applyBatchThreshold(val: number | null) {
    setCounters((s) => s.map(c => ({ ...c, maxValue: val })))
    closeBatchModal()
  }

  return (
    <div className="cp-container">
      <div className="cp-header">
        <h1 className="cp-title">自动统计计数器</h1>

            <div className="cp-controls">
          <div className="cp-theme">
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
            <Button type="default" size="middle" onClick={resetAll} disabled={counters.length===0}>重置全部</Button>
            <Button type="default" size="middle" onClick={openBatchModal} disabled={counters.length===0}>批量修改阈值</Button>
            <Button type="default" size="middle" onClick={() => openModal(null)}>添加计数器</Button>
          </div>
        </div>

        <div className="cp-total">{counters.reduce((a, b) => a + b.value, 0)}</div>
      </div>

      <div className="cp-body">
        {counters.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-emoji">📊</div>
            <div>还没有计数器，点击上方按钮添加一个吧！</div>
          </div>
        ) : (
          <div className="cp-grid">
            {counters.map((counter, idx) => (
              <div key={counter.id} className="cp-card">
                <div className="cp-card-header">
                  <h3 className="cp-card-title">{counter.name}</h3>
                  <div className="cp-card-controls">
                    <Button type="primary" size="middle" onClick={() => openModal(idx)} title="编辑">编辑</Button>
                    <Button type="default" danger size="middle" onClick={() => deleteCounter(idx)} title="删除">删除</Button>
                  </div>
                </div>

                <div className="cp-avatar-row">
                  <div className="cp-avatar-wrapper">
                    {counter.image ? (
                      <AntdImage src={counter.image} alt={counter.name} className="cp-avatar" preview />
                    ) : (
                      <div onClick={() => openImagePicker(idx)} className="cp-avatar-placeholder">点击选择图片</div>
                    )}
                  </div>
                  <Button type="default" size="small" shape="circle" className="cp-change-btn" title="更换图片" onClick={(e) => { e.stopPropagation(); openImagePicker(idx) }}>⟳</Button>
                </div>

                <div className="cp-value">{counter.value}</div>

                <div className="cp-threshold">{counter.maxValue ? <div className="cp-threshold-inner">{counter.maxValue && counter.value >= counter.maxValue ? '⚠️ ' : ''}最大阈值: {counter.maxValue}</div> : null}</div>

                <div className="cp-footer-buttons">
                  <Button type="default" size="middle" onClick={() => decrease(idx)} disabled={counter.value===0}>−</Button>
                  <Button type="default" size="middle" onClick={() => resetCounter(idx)}>重置</Button>
                  <Button type="default" size="middle" onClick={() => increase(idx)}>+</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

  <input ref={imageInputRef} type="file" accept="image/*" className="cp-file-input" onChange={handleImageSelected} />

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

import React, { useEffect, useMemo, useState } from 'react'
import { Table, Input, InputNumber, Button, Popconfirm, Space, Modal, Upload, message, Image } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'

type Item = { id: number; name: string; price: number; qty: number; img?: string | null }

const STORAGE_KEY = 'income_data_v1'

type Persisted = { items: Item[]; dailyGoldPrice?: number }

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [], dailyGoldPrice: 0 }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { items: parsed as Item[], dailyGoldPrice: 0 }
    return parsed as Persisted
  } catch (e) {
    console.error('load income error', e)
    return { items: [], dailyGoldPrice: 0 }
  }
}

function saveState(state: Persisted) {
  try {
    // Avoid writing large data URLs into localStorage which has very small quota.
    // Replace any img fields that are data URLs with null before persisting.
    const safe: Persisted = {
      dailyGoldPrice: state.dailyGoldPrice,
      items: (state.items || []).map((it) => {
        const copy: Item = { ...it }
        if (copy.img && copy.img.startsWith && copy.img.startsWith('data:')) {
          // drop inline base64 to avoid quota errors; migration on mount will try to move them to IDB
          console.warn('Dropping inline image data from localStorage for item', copy.id)
          copy.img = null
        }
        return copy
      })
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  } catch (e) {
    console.error('save income error', e)
  }
}

export default function SecondPage(): JSX.Element {
  const persisted = loadState()
  const [messageApi, messageContextHolder] = message.useMessage()
  const [modalApi, modalContextHolder] = Modal.useModal()
  const [items, setItems] = useState<Item[]>(() => persisted.items || [])
  const [dailyGoldPrice, setDailyGoldPrice] = useState<number>(() => persisted.dailyGoldPrice || 0)
  const [modalVisible, setModalVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newName, setNewName] = useState('新类目')
  const [newPrice, setNewPrice] = useState<number>(0)
  const [newQty, setNewQty] = useState<number>(0)
  const [newImg, setNewImg] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<number>(5)
  // searchInput: immediate input value; searchText: debounced value used for filtering
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchText, setSearchText] = useState<string>('')
  // Note: images are stored on server under /assets/uploads and `item.img` holds that URL or a data: URL

  // Upload constraints (可按需调整)
  const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
  const MAX_IMAGE_WIDTH = 4000
  const MAX_IMAGE_HEIGHT = 4000


  const humanFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        const w = img.width
        const h = img.height
        try { URL.revokeObjectURL(url) } catch (e) { }
        resolve({ width: w, height: h })
      }
      img.onerror = (err) => {
        try { URL.revokeObjectURL(url) } catch (e) { }
        reject(err)
      }
      img.src = url
    })
  }

  // Compress a data URL using a canvas. Uses window.Image to avoid collision with antd Image import.
  const compressDataUrl = (dataUrl: string, maxWidth = 800, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        // draw image first
        ctx.drawImage(img, 0, 0, width, height)

        // decide output mime: preserve PNG if source dataUrl is PNG
        const isSourcePng = dataUrl.startsWith('data:image/png')
        const mime = isSourcePng ? 'image/png' : 'image/jpeg'

        const blobCb = (blob: Blob | null) => {
          if (!blob) return reject(new Error('compress failed'))
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = () => reject(new Error('read blob failed'))
          r.readAsDataURL(blob)
        }

        if (mime === 'image/png') {
          canvas.toBlob(blobCb, mime)
        } else {
          // jpeg: provide quality
          // fill white background to avoid black transparent areas when converting to jpeg
          const fillCanvas = document.createElement('canvas')
          fillCanvas.width = canvas.width
          fillCanvas.height = canvas.height
          const fctx = fillCanvas.getContext('2d')!
          fctx.fillStyle = '#ffffff'
          fctx.fillRect(0, 0, fillCanvas.width, fillCanvas.height)
          fctx.drawImage(canvas, 0, 0)
          fillCanvas.toBlob(blobCb, mime, quality)
        }
      }
      img.onerror = () => reject(new Error('image load error'))
      img.src = dataUrl
    })
  }

  // Try compressing the dataUrl and upload each attempt to the local upload server.
  // Helper: convert Blob to dataURL
  const blobToDataURL = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (e) => reject(e)
    reader.readAsDataURL(blob)
  })

  const isElectron = typeof (window as any)?.electronAPI !== 'undefined'

  // Unified uploader: use Electron IPC when available, otherwise POST to local server.
  const uploadBlob = async (blob: Blob, filename?: string): Promise<string> => {
    if (isElectron) {
      // convert to base64 and call main process
      const b64 = await blobToDataURL(blob)
      const resp = await (window as any).electronAPI.saveImage({ name: filename || `img_${Date.now()}.jpg`, base64: b64 })
      // resp expected { ok: true, url, filename }
      return resp?.url
    } else {
      const fd = new FormData()
      fd.append('file', blob, filename || `upload_${Date.now()}.jpg`)
      const resp = await fetch('http://localhost:3001/upload', { method: 'POST', body: fd })
      if (!resp.ok) throw new Error('upload failed')
      const json = await resp.json()
      return json.url as string
    }
  }

  const tryCompressAndUpload = async (dataUrl: string): Promise<string | null> => {
    const qualities = [0.8, 0.6, 0.4, 0.2]
    for (const q of qualities) {
      try {
        const compressed = await compressDataUrl(dataUrl, 800, q)
        const blob = await (await fetch(compressed)).blob()
        const url = await uploadBlob(blob, `upload_${Date.now()}.jpg`)
        return url
      } catch (e) {
        // try next quality
      }
    }
    return null
  }

  useEffect(() => {
    saveState({ items, dailyGoldPrice })
  }, [items, dailyGoldPrice])

  // Migration to IndexedDB has been removed; images are stored on server under /assets/uploads
  const migratingIdsRef = React.useRef<Record<number, boolean>>({})

  const openAddModal = () => {
    setEditingId(null)
    setNewName('新类目')
    setNewPrice(0)
    setNewQty(0)
    setNewImg(null)
    setModalVisible(true)
  }

  const handleSave = async () => {
    setCreating(true)
    try {
      // Ensure newImg is uploaded to the local server (http://localhost:3001/upload) when it's a data URL
      let finalImg: string | null = newImg
      if (finalImg && finalImg.startsWith && finalImg.startsWith('data:')) {
        try {
          // convert dataURL to blob and upload
          const blob = await (await fetch(finalImg)).blob()
          const fd = new FormData()
          fd.append('file', blob, `upload_${Date.now()}.jpg`)
          const resp = await fetch('http://localhost:3001/upload', { method: 'POST', body: fd })
          console.log(resp);
          if (!resp.ok) throw new Error('upload failed')
          const json = await resp.json()
          finalImg = json.url as string
        } catch (e) {
          // Initial upload failed — try compressing and uploading with decreasing quality.
          let compressedUrl: string | null = null
          try {
            compressedUrl = await tryCompressAndUpload(finalImg)
          } catch (err) {
            compressedUrl = null
          }
          if (compressedUrl) {
            finalImg = compressedUrl
          } else {
            // Ask user whether to continue saving without image or cancel the save.
            const proceedWithout = await new Promise<boolean>((resolve) => {
              modalApi.confirm({
                title: '图片保存失败',
                content: '无法将图片上传到本地（可能图片过大）。是否继续保存条目但去掉图片？取消将中止保存。',
                okText: '保存但去掉图片',
                cancelText: '取消',
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
              })
            })
            if (proceedWithout) {
              messageApi.warning('图片已从条目中移除')
              finalImg = null
            } else {
              // abort save
              setCreating(false)
              return
            }
          }
        }
      }

      if (editingId === null) {
        const id = Date.now()
        setItems((s) => [...s, { id, name: newName, price: newPrice, qty: newQty, img: finalImg }])
        messageApi.success('新增成功')
      } else {
        setItems((s) => s.map((it) => it.id === editingId ? { ...it, name: newName, price: newPrice, qty: newQty, img: finalImg } : it))
        messageApi.success('保存成功')
      }
      setModalVisible(false)
    } finally {
      setCreating(false)
    }
  }

  const openEditModal = (id: number) => {
    const it = items.find((x) => x.id === id)
    if (!it) return
    setEditingId(id)
    setNewName(it.name)
    setNewPrice(it.price)
    setNewQty(it.qty)
    setNewImg(it.img ?? null)
    setModalVisible(true)
  }

  const updateItem = (id: number, patch: Partial<Item>) => {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = async (id: number) => {
    const it = items.find((x) => x.id === id)
    if (it && it.img && !(it.img.startsWith && it.img.startsWith('data:'))) {
      // Best-effort: delete on server or via Electron IPC
      try {
        if (isElectron) {
          const filename = (it.img as string).split('/').pop()
          await (window as any).electronAPI.deleteImage({ filename })
        } else {
          await fetch('http://localhost:3001/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: it.img })
          })
        }
        messageApi.success('已删除图片')
      } catch (e) {
        messageApi.warning('尝试删除图片失败（可能网络或服务器问题）')
      }
    }
    // remove locally regardless of server-delete result
    setItems((s) => s.filter((it) => it.id !== id))
  }

  // debounce searchInput -> searchText
  useEffect(() => {
    const t = setTimeout(() => setSearchText(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const dataSource = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const list = q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items
    return list.map((it) => ({ key: it.id, ...it }))
  }, [items, searchText])

  // Images are server-hosted; `item.img` should be a URL (e.g. "/assets/uploads/...") or a data: URL.

  const resetAllQty = () => {
    setItems((s) => s.map((it) => ({ ...it, qty: 0 })))
    messageApi.success('所有数量已重置为 0')
  }

  // total is in 万 (because price input is in 万)
  const total = useMemo(() => items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0), [items])
  // totalByGold (元) = dailyGoldPrice (元/万) * total (万)
  const totalByGold = useMemo(() => (Number(dailyGoldPrice) || 0) * total, [total, dailyGoldPrice])

  const beforeUploadToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
    })
  }

  const uploadProps = {
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: async (file: File) => {
      try {
        // show actual file size and check dimensions/size limits
        const size = file.size
        let dims: { width: number; height: number } | null = null
        try {
          dims = await getImageDimensions(file)
        } catch (e) {
          // ignore dimension read failures; still check size
        }
        const sizeText = humanFileSize(size)
        const dimText = dims ? `${dims.width} x ${dims.height}` : '未知'
        // show an informational toast about size/dimensions
        messageApi.info(`图片大小: ${sizeText}，尺寸: ${dimText}`)

        // enforce size/dimension limits
        if (size > MAX_FILE_SIZE) {
          messageApi.error(`图片过大，最大允许 ${humanFileSize(MAX_FILE_SIZE)}，当前 ${sizeText}`)
          return Upload.LIST_IGNORE
        }
        if (dims && (dims.width > MAX_IMAGE_WIDTH || dims.height > MAX_IMAGE_HEIGHT)) {
          messageApi.error(`图片像素过大，最大允许 ${MAX_IMAGE_WIDTH} x ${MAX_IMAGE_HEIGHT}，当前 ${dimText}`)
          return Upload.LIST_IGNORE
        }

        // Try to upload the original file to local server
        try {
          // try uploading the raw file via unified uploader
          const blob = file
          const url = await uploadBlob(blob, file.name)
          setNewImg(url)
        } catch (e) {
          // fallback to storing data url in state (legacy)
          const b64 = await beforeUploadToBase64(file)
          setNewImg(b64)
        }
        return false
      } catch (e) {
        messageApi.error('无法读取图片')
        return Upload.LIST_IGNORE
      }
    }
  }

  const columns = [
    {
      title: '图片',
      dataIndex: 'img',
      width: 100,
      render: (val: string | undefined) => {
        if (!val) return <div style={{ width: 64, height: 40, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>无</div>
        const isData = val && val.startsWith && val.startsWith('data:')
        const src = val
        const loading = !src
        return (
          <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {loading ? (
              <div style={{ width: 64, height: 40, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>加载中</div>
            ) : (
              <Image src={src} width={64} height={40} style={{ objectFit: 'contain', background: '#f5f5f5', padding: 4 }} />
            )}
            {!isData ? (
              <a
                style={{ fontSize: 11, color: '#1890ff', cursor: 'pointer' }}
                onClick={async () => {
                  try {
                    const valStr = String(val)
                    if (window && (window as any).electronAPI && (window as any).electronAPI.showItem) {
                      // If it's a file:// URL, show directly
                        if (valStr.startsWith('file://')) {
                          const p = valStr.replace(/^file:\/\//, '')
                          await (window as any).electronAPI.showItem(p)
                          messageApi.info(`已打开：${p}`)
                          return
                        }
                        // If it's a project-relative assets path like /assets/uploads/..., ask main to resolve and show absolute path
                        if (valStr.startsWith('/')) {
                          const resp = await (window as any).electronAPI.showRelative(valStr)
                          if (resp && resp.ok) {
                            messageApi.info(`已打开：${resp.path}`)
                          } else {
                            messageApi.warning(`无法打开路径：${resp?.error ?? '未找到'}`)
                          }
                          return
                        }
                        // Fallback: try to open as external URL
                        window.open(valStr, '_blank')
                    } else {
                      // not in electron: open URL in new tab
                      window.open(valStr, '_blank')
                    }
                  } catch (e) {
                    try { window.open(String(val), '_blank') } catch (err) { /* ignore */ }
                  }
                }}
              >
                已本地
              </a>
            ) : (
              <div style={{ fontSize: 11, color: '#999' }}>临时</div>
            )}
          </div>
        )
      }
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (val: string, record: Item) => (
        <Input disabled value={val} onChange={(e) => updateItem(record.id, { name: e.target.value })} />
      )
    },
    {
      title: '单价（万）',
      dataIndex: 'price',
      width: 160,
      render: (val: number, record: Item) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <InputNumber disabled style={{ width: '100%' }} min={0} value={val} onChange={(v) => updateItem(record.id, { price: Number(v) || 0 })} />
          <div style={{ minWidth: 28 }}>万</div>
        </div>
      )
    },
    {
      title: '数量',
      dataIndex: 'qty',
      width: 160,
      render: (val: number, record: Item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button size="small" onClick={() => updateItem(record.id, { qty: Math.max(0, (record.qty || 0) - 1) })}>-</Button>
          <div style={{ minWidth: 48, textAlign: 'center' }}>{record.qty}</div>
          <Button size="small" onClick={() => updateItem(record.id, { qty: (record.qty || 0) + 1 })}>+</Button>
        </div>
      )
    },
    {
      title: '按当日金价金额（元）',
      dataIndex: 'amountByGold',
      width: 180,
      render: (_: any, record: Item) => {
        // dailyGoldPrice is 元/万, record.price is 万, so per-row gold amount (元) = price(万) * qty * dailyGoldPrice(元/万)
        const amt = (Number(record.price) || 0) * (Number(record.qty) || 0) * (Number(dailyGoldPrice) || 0)
        return <div>{amt.toFixed(2)}</div>
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 160,
      render: (_: any, record: Item) => {
        // price is in 万, convert to 元
        const amt = (Number(record.price) || 0) * (Number(record.qty) || 0) * 10000
        return <div>{amt.toFixed(2)}</div>
      }
    },
    {
      title: '操作',
      dataIndex: 'op',
      width: 160,
      render: (_: any, record: Item) => (
        <Space>
          <Button size="small" onClick={() => openEditModal(record.id)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => removeItem(record.id)} okText="是" cancelText="否">
            <Button danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h2>收益统计</h2>
      {messageContextHolder}
      {modalContextHolder}

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Space align="center">
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>新增类目</Button>
          {/* <Button onClick={async () => {
            // 清空 items（服务器上的文件不会被自动删除）
            setItems([])
            setNewImg(null)
            messageApi.success('已清空所有条目')
          }}>清空</Button> */}
          <Space.Compact style={{ width: 220 }}>
            <Input placeholder="搜索名称" allowClear value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setSearchText(searchInput) }} />
            {/* <Button onClick={() => setSearchText(searchInput)}>搜索</Button> */}
          </Space.Compact>
          <Popconfirm title="确定要将所有数量重置为 0 吗？" onConfirm={resetAllQty} okText="是" cancelText="否">
            <Button>一键清零</Button>
          </Popconfirm>
        </Space>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>当日金价（元/万）: </div>
          <InputNumber min={0} value={dailyGoldPrice} onChange={(v) => setDailyGoldPrice(Number(v) || 0)} />
          <div style={{ fontWeight: 600 }}>金价总计(元): ¥ {totalByGold.toFixed(2)}</div>
          <div style={{ fontWeight: 600 }}>总计(万): {total.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          pagination={{ pageSize, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'], onChange: (_page: number, size?: number) => { if (size) setPageSize(size) } }}
          dataSource={dataSource}
          columns={columns as any}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, paddingRight: 12 }}>
              <div style={{ fontWeight: 600 }}>总计(万): {total.toFixed(2)}</div>
              <div style={{ fontWeight: 600 }}>金价总计(元): ¥ {totalByGold.toFixed(2)}</div>
            </div>
          )}
        />
      </div>

      <Modal title={editingId === null ? '新增类目' : '编辑类目'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} confirmLoading={creating} okText={editingId === null ? '添加' : '保存'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>名称</div>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 6 }}>单价（万）</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber style={{ width: '100%' }} min={0} value={newPrice} onChange={(v) => setNewPrice(Number(v) || 0)} />
                <div style={{ minWidth: 28 }}>万</div>
              </div>
            </div>

            <div style={{ width: 140 }}>
              <div style={{ marginBottom: 6 }}>数量</div>
              <InputNumber style={{ width: '100%' }} min={0} value={newQty} onChange={(v) => setNewQty(Number(v) || 0)} />
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>图片（可选）</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择图片</Button>
              </Upload>
              {newImg ? (
                newImg.startsWith && newImg.startsWith('data:') ? (
                  <Image src={newImg} width={80} height={60} style={{ objectFit: 'cover' }} />
                ) : (
                  <Image src={newImg} width={80} height={60} style={{ objectFit: 'cover' }} />
                )
              ) : null}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

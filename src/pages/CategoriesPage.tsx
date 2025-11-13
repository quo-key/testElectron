import React, { useEffect, useState } from 'react'
import { Button, Modal, Form, Input, List, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Category, Counter, Persisted, loadState, saveState } from '../lib/state'
export default function CategoriesPage(): JSX.Element {
  const [modalApi, modalContextHolder] = Modal.useModal()
  const nav = useNavigate()
  const persisted = loadState()
  const [messageApi, messageContextHolder] = message.useMessage()
  // No default category: start with persisted categories (may be empty)
  const [categories, setCategories] = useState<Category[]>(() => (persisted && Array.isArray(persisted.categories)) ? persisted.categories : [])
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    form.resetFields()
  }, [formOpen, editingId])

  function openNew() { setEditingId(null); form.resetFields(); setFormOpen(true) }
  function openEdit(id: number) { setEditingId(id); const c = categories.find(x => x.id === id); form.setFieldsValue({ name: c?.name }); setFormOpen(true) }

  function handleDelete(id: number) {
    const cat = categories.find(x => x.id === id)
    if (!cat) return
    modalApi.confirm({
      title: '删除场景',
      content: `删除场景 "${cat.name}" 会同时删除其下所有计数器，确定吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          // load persisted state to find counters under this category
          const persistedState = loadState()
          const toDelete = persistedState.counters.filter(c => c.categoryId === id && c.image && !(c.image.startsWith && c.image.startsWith('data:')))
          const isElectron = typeof (window as any)?.electronAPI !== 'undefined'
          for (const it of toDelete) {
            try {
              if (isElectron) {
                const filename = String(it.image).split('/').pop()
                await (window as any).electronAPI.deleteImage({ filename })
              } else {
                await fetch('http://localhost:3001/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: it.image }) })
              }
            } catch (e) { /* ignore per-item delete errors */ }
          }
          // remove category and its counters from persisted state
          const newCats = categories.filter(x => x.id !== id)
          persistedState.categories = newCats
          persistedState.counters = persistedState.counters.filter(c => c.categoryId !== id)
          saveState(persistedState)
          setCategories(newCats)
          // notify other pages
          window.dispatchEvent(new Event('appStateChanged'))
          messageApi.success('已删除')
        } catch (e) {
          // ensure we still remove from UI even if deletion attempt failed
          const newCats = categories.filter(x => x.id !== id)
          const persistedState = loadState()
          persistedState.categories = newCats
          persistedState.counters = persistedState.counters.filter(c => c.categoryId !== id)
          saveState(persistedState)
          setCategories(newCats)
          window.dispatchEvent(new Event('appStateChanged'))
          messageApi.success('已删除')
        }
      }
    })
  }

  function handleOk() {
    form.validateFields().then(values => {
      const name = values.name.trim()
      if (!name) return
      const persistedState = loadState()
      const nameLower = name.toLowerCase()
      const duplicate = persistedState.categories.some(c => c.name.trim().toLowerCase() === nameLower && c.id !== editingId)
  if (duplicate) { messageApi.error('已存在相同名称的场景，请使用不同名称'); return }
      if (editingId === null) {
        const id = Date.now()
        const cat: Category = { id, name }
        persistedState.categories = [...persistedState.categories, cat]
        saveState(persistedState)
        setCategories(persistedState.categories)
      } else {
        persistedState.categories = persistedState.categories.map(c => c.id === editingId ? { ...c, name } : c)
        saveState(persistedState)
        setCategories(persistedState.categories)
  messageApi.success('场景名称已更新，计数器显示将随之变化')
      }
      setFormOpen(false)
      window.dispatchEvent(new Event('appStateChanged'))
  messageApi.success('保存成功')
    }).catch(() => {})
  }

  return (
    <div style={{ padding: 20 }}>
      {messageContextHolder}
      {modalContextHolder}
      {/* keep a hidden Form connected to the form instance so Form.useForm() is attached
          This avoids the warning when the actual Modal form is not mounted immediately */}
      <Form form={form} style={{ display: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>场景管理</h2>
        {/* <div style={{ marginLeft: 'auto' }}>
          <Button onClick={() => nav('/')}>返回计数器</Button>
        </div> */}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openNew}>添加场景</Button>
      </div>

      <List bordered dataSource={categories} renderItem={item => (
        <List.Item actions={[<a key="edit" onClick={() => openEdit(item.id)}>编辑</a>, <a key="del" onClick={() => handleDelete(item.id)}>删除</a>]}> 
          <div>{item.name}</div>
        </List.Item>
      )} />

      <Modal open={formOpen} title={editingId ? '编辑场景' : '添加场景'} onCancel={() => setFormOpen(false)} onOk={handleOk} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="场景名称" rules={[{ required: true, message: '请输入场景名称' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

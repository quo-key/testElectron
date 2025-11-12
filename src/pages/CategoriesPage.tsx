import React, { useEffect, useState } from 'react'
import { Button, Modal, Form, Input, List, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Category, Counter, Persisted, loadState, saveState } from '../lib/state'

export default function CategoriesPage(): JSX.Element {
  const nav = useNavigate()
  const persisted = loadState()
  const [categories, setCategories] = useState<Category[]>(persisted.categories.length ? persisted.categories : [{ id: Date.now(), name: '默认' }])
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
    Modal.confirm({ title: '删除场景', content: `删除场景 "${cat.name}" 会同时删除其下所有计数器，确定吗？`, okText: '删除', okButtonProps: { danger: true }, onOk() {
      const newCats = categories.filter(x => x.id !== id)
      const persistedState = loadState()
      persistedState.categories = newCats
      persistedState.counters = persistedState.counters.filter(c => c.categoryId !== id)
      saveState(persistedState)
      setCategories(newCats)
      // notify other pages
      window.dispatchEvent(new Event('appStateChanged'))
      message.success('已删除')
    }})
  }

  function handleOk() {
    form.validateFields().then(values => {
      const name = values.name.trim()
      if (!name) return
      const persistedState = loadState()
      const nameLower = name.toLowerCase()
      const duplicate = persistedState.categories.some(c => c.name.trim().toLowerCase() === nameLower && c.id !== editingId)
      if (duplicate) { message.error('已存在相同名称的场景，请使用不同名称'); return }
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
        message.success('场景名称已更新，计数器显示将随之变化')
      }
      setFormOpen(false)
      window.dispatchEvent(new Event('appStateChanged'))
      message.success('保存成功')
    }).catch(() => {})
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>场景管理</h2>
        <div style={{ marginLeft: 'auto' }}>
          <Button onClick={() => nav('/')}>返回计数器</Button>
        </div>
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

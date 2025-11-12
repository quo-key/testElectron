import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
// Ant Design global reset styles
import 'antd/dist/reset.css'

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

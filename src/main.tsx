import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
// Ant Design global reset styles
import 'antd/dist/reset.css'
import { ConfigProvider, theme as antdTheme } from 'antd'

const { defaultAlgorithm, darkAlgorithm } = antdTheme

const container = document.getElementById('root')!
const root = createRoot(container)

function Root(): JSX.Element {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    try { const v = localStorage.getItem('app_theme'); return v === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })

  React.useEffect(() => {
    try { localStorage.setItem('app_theme', theme) } catch {}
    try { document.documentElement.setAttribute('data-theme', theme) } catch {}
  }, [theme])

  const token = theme === 'dark' ? {
    colorPrimary: '#1677ff',
    colorBgContainer: '#001529',
    colorBgBase: '#0b1220',
    colorTextBase: '#ffffff',
    colorTextSecondary: '#bfbfbf'
  } : {
    colorPrimary: '#1677ff',
    colorBgContainer: '#ffffff',
    colorBgBase: '#f5f7fb',
    colorTextBase: '#000000',
    colorTextSecondary: '#595959'
  }

  return (
    <ConfigProvider theme={{ algorithm: theme === 'dark' ? darkAlgorithm : defaultAlgorithm, token }}>
      <App theme={theme} setTheme={setTheme} />
    </ConfigProvider>
  )
}

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)

import React from 'react'
import { createHashRouter, RouterProvider, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Tabs, Menu, Switch } from 'antd'
import BeijingClock from './components/BeijingClock'
import { HomeOutlined, UnorderedListOutlined, AppstoreOutlined, BulbOutlined, MoonOutlined } from '@ant-design/icons'
import { CountersPage, CategoriesPage, SecondPage } from './pages'
import './index.css'

const { Header, Sider, Content } = Layout

const FIRST_MENU_ITEMS = [
  { key: '/firstPage', label: '计数器', icon: <HomeOutlined /> },
  { key: '/firstPage/categories', label: '场景管理', icon: <UnorderedListOutlined /> }
]

const SECOND_MENU_ITEMS = [
  { key: '/secondPage', label: '每日收益统计', icon: <AppstoreOutlined /> }
]

function MainLayout({ theme, setTheme }: { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }) {
  const loc = useLocation()
  const navigate = useNavigate()

  const activeTop = loc.pathname.startsWith('/secondPage') ? 'second' : 'first'
  const currentMenuItems = activeTop === 'second' ? SECOND_MENU_ITEMS : FIRST_MENU_ITEMS


  return (
    <Layout style={{ height: '100vh', background: theme === 'dark' ? '#111827' : '#f5f7fb' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 12, background: theme === 'dark' ? '#001529' : '#fff', padding: '0 16px' }}>
        {/* <div style={{ color: theme === 'dark' ? '#fff' : '#000', fontWeight: 700, marginRight: 12 }}>应用导航</div> */}

        <Tabs
          activeKey={activeTop}
          onChange={(key) => { if (key === 'first') navigate('/firstPage') ; else navigate('/secondPage') }}
          tabBarStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
          items={[
            { key: 'first', label: 'FirstPage' },
            { key: 'second', label: 'SecondPage' }
          ]}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BeijingClock />
          <span style={{ color: theme === 'dark' ? '#fff' : '#000', fontSize: 12 }}>{theme === 'dark' ? '深色' : '浅色'}</span>
          <Switch
            checked={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<BulbOutlined />}
          />
        </div>
      </Header>

      <Layout>
        <Sider width={220} theme={theme} style={ theme === 'dark' ? { background: '#001529' } : { background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu mode="inline" theme={theme} selectedKeys={[loc.pathname]} onClick={(e) => navigate(e.key)} items={currentMenuItems} />
        </Sider>

        <Content style={{ padding: 12, overflow: 'hidden', background: theme === 'dark' ? '#0b1220' : '#f5f7fb' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App({ theme, setTheme }: { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }): JSX.Element {
  // create a hash router and opt into v7 future flags to avoid console warnings
  const router = createHashRouter([
    {
      path: '/',
      element: <MainLayout theme={theme} setTheme={setTheme} />,
      children: [
        { index: true, element: <Navigate to="/firstPage" replace /> },
        {
          path: 'firstPage',
          children: [
            { index: true, element: <CountersPage theme={theme} setTheme={setTheme} /> },
            { path: 'categories', element: <CategoriesPage /> }
          ]
        },
        { path: 'secondPage', children: [{ index: true, element: <SecondPage /> }] }
      ]
    }
  ], {
    // opt in to v7 behaviors to silence warnings and adopt future behavior early
    // cast to any because the project's installed @types may not yet include these future flags
    future: {
      v7_startTransition: true
    }
  } as any)

  return <RouterProvider router={router} />
}

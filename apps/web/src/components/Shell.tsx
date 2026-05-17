import { useState, useEffect } from 'react'
import { Layout, Menu, Drawer, Avatar, Dropdown, Space, Typography, Button, Tooltip } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined, NodeIndexOutlined, FolderOpenOutlined,
  HistoryOutlined, SettingOutlined, FileTextOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { ThemeToggle } from './ThemeToggle.js'
import { useResponsive } from '../hooks/useResponsive.js'
import { useLogout } from '../api/auth.js'

const { Sider, Header, Content } = Layout
const { Title, Text } = Typography

const NAV_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/routes',    icon: <NodeIndexOutlined />,  label: 'Routes' },
  { key: '/files',     icon: <FolderOpenOutlined />, label: 'Files' },
  { key: '/history',   icon: <HistoryOutlined />,    label: 'History' },
  { key: '/settings',  icon: <SettingOutlined />,    label: 'Settings' },
  { key: '/logs',      icon: <FileTextOutlined />,   label: 'Logs' },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/routes':    'Routes',
  '/files':     'Files',
  '/history':   'History',
  '/settings':  'Settings',
  '/logs':      'Logs',
}

interface Props {
  theme: 'light' | 'dark'
  onToggle: () => void
  username: string
}

export function Shell({ theme, onToggle, username }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobileOrTablet, contentPadding } = useResponsive()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const logout = useLogout()

  useEffect(() => {
    if (isMobileOrTablet) {
      setCollapsed(true)
      setDrawerOpen(false)
    }
  }, [isMobileOrTablet])

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'unginx'
  const marginLeft = isMobileOrTablet ? 0 : collapsed ? 72 : 220

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: () => logout.mutate(),
    },
  ]

  const sidebarContent = (
    <div className="sidebar-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo zone */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        flexShrink: 0,
        padding: collapsed ? 0 : '0 16px',
        gap: collapsed ? 0 : 8,
      }}
        onClick={() => isMobileOrTablet ? setDrawerOpen(false) : setCollapsed(!collapsed)}
        role="button"
        aria-label="Toggle sidebar"
      >
        <img
          src={`${import.meta.env.BASE_URL}unginx-logo.png`}
          alt="unginx"
          style={{
            height: collapsed ? 32 : 40,
            width: 'auto',
            transition: 'all 0.2s ease',
          }}
        />
        {!collapsed && (
          <Text strong style={{ color: 'var(--text-primary)', fontSize: 16, whiteSpace: 'nowrap' }}>
            unginx
          </Text>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', marginTop: 8 }}>
        <Menu
          mode="inline"
          theme={theme === 'dark' ? 'dark' : 'light'}
          selectedKeys={[location.pathname]}
          inlineCollapsed={collapsed}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>

      {/* Footer / Attribution */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: collapsed ? '12px 0' : '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 8,
        flexShrink: 0,
      }}>
        {!collapsed ? (
          <>
            <img src={`${import.meta.env.BASE_URL}unginx-logo.png`} alt="unginx" style={{ height: 20, width: 'auto', opacity: 0.7 }} />
            <Text style={{
              fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
              letterSpacing: '0.5px', color: 'var(--text-muted)',
            }}>
              unginx
            </Text>
          </>
        ) : (
          <img src={`${import.meta.env.BASE_URL}unginx-logo.png`} alt="unginx" style={{ height: 24, width: 'auto', opacity: 0.6 }} />
        )}
      </div>
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* Fixed sidebar (desktop/laptop) */}
      {!isMobileOrTablet && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={220}
          collapsedWidth={72}
          style={{
            overflow: 'hidden',
            height: '100vh',
            position: 'fixed',
            left: 0, top: 0, bottom: 0,
            zIndex: 100,
            borderRight: '1px solid var(--border-subtle)',
            background: 'var(--shell)',
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile drawer */}
      <Drawer
        placement="left"
        open={drawerOpen && isMobileOrTablet}
        onClose={() => setDrawerOpen(false)}
        width={260}
        styles={{
          body:   { padding: 0, background: 'var(--shell)', height: '100%' },
          header: { display: 'none' },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main area */}
      <Layout style={{
        marginLeft,
        transition: 'margin-left 0.2s ease',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Sticky Header */}
        <Header style={{
          padding: `0 ${contentPadding}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--shell)',
          height: 64,
          minHeight: 64,
          lineHeight: '64px',
        }}>
          {/* Left: hamburger (mobile) + page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobileOrTablet && (
              <Button
                type="text"
                icon={drawerOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                onClick={() => setDrawerOpen(!drawerOpen)}
                style={{ fontSize: 18, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            )}
            {!isMobileOrTablet && (
              <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setCollapsed(!collapsed)}
                  style={{ fontSize: 16, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                />
              </Tooltip>
            )}
            <Title level={5} style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', fontWeight: 600 }}>
              {pageTitle}
            </Title>
          </div>

          {/* Right: ThemeToggle + user dropdown */}
          <Space size="middle">
            <ThemeToggle theme={theme} onToggle={onToggle} />
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar
                  style={{ background: 'var(--accent-primary)', color: '#ffffff', fontSize: 14 }}
                  icon={<UserOutlined />}
                  size={32}
                />
                <Text
                  style={{ color: 'var(--text-primary)', fontSize: 14, display: 'none' }}
                  className="sm:inline"
                >
                  {username}
                </Text>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Page content */}
        <Content style={{
          padding: contentPadding,
          flex: 1,
          overflow: 'auto',
          background: 'var(--canvas)',
        }}>
          <div style={{ maxWidth: 1920, margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

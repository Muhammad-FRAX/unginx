import { Tooltip, Button } from 'antd'
import { BulbOutlined, BulbFilled } from '@ant-design/icons'

interface Props {
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <Tooltip title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
      <Button
        type="text"
        icon={theme === 'dark' ? <BulbOutlined /> : <BulbFilled />}
        onClick={onToggle}
        style={{
          fontSize: 18,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      />
    </Tooltip>
  )
}

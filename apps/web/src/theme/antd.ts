import { theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'
import { lightTokens, darkTokens } from './tokens.js'

function buildAntdConfig(tokens: typeof lightTokens, isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary:         tokens.accentPrimary,
      colorSuccess:         tokens.statusSuccess,
      colorWarning:         tokens.statusWarning,
      colorError:           tokens.statusDanger,
      colorInfo:            tokens.statusInfo,
      colorBgBase:          tokens.canvas,
      colorBgContainer:     tokens.surface,
      colorBgElevated:      tokens.elevated,
      colorBorder:          tokens.borderSubtle,
      colorBorderSecondary: tokens.borderStrong,
      colorText:            tokens.textPrimary,
      colorTextSecondary:   tokens.textSecondary,
      colorTextTertiary:    tokens.textMuted,
      fontFamily:           '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize:             14,
      lineHeight:           1.5714,
      borderRadius:         6,
      borderRadiusLG:       8,
      borderRadiusSM:       4,
    },
    components: {
      Layout: {
        siderBg: tokens.shell,
        headerBg: tokens.shell,
        bodyBg:   tokens.canvas,
      },
      Menu: {
        darkItemBg:          tokens.shell,
        darkSubMenuItemBg:   tokens.shell,
        darkItemHoverBg:     tokens.hover,
        darkItemSelectedBg:  tokens.accentPrimarySoft,
        darkItemSelectedColor: tokens.accentPrimary,
      },
    },
  }
}

export const lightAntdConfig = buildAntdConfig(lightTokens, false)
export const darkAntdConfig  = buildAntdConfig(darkTokens, true)

export function getAntdConfig(mode: 'light' | 'dark'): ThemeConfig {
  return mode === 'dark' ? darkAntdConfig : lightAntdConfig
}

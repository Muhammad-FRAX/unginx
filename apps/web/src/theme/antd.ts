import { theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'
import { lightTokens, darkTokens, type TokenMap } from './tokens.js'

const baseTokens = {
  fontSize:           14,
  fontSizeHeading1:   32, fontSizeHeading2: 24, fontSizeHeading3: 20,
  fontSizeHeading4:   18, fontSizeHeading5: 16,
  fontSizeLG:         16, fontSizeSM: 12, fontSizeXL: 20,
  lineHeight:         1.5714,
  lineHeightHeading1: 1.25, lineHeightHeading2: 1.33,
  lineHeightHeading3: 1.4,  lineHeightHeading4: 1.5,
  lineHeightHeading5: 1.5,
  borderRadius:    8, borderRadiusLG: 12, borderRadiusSM: 6, borderRadiusXS: 4,
  padding:   16, paddingLG:  24, paddingSM:  12, paddingXS:  8, paddingXXS: 4,
  margin:    16, marginLG:   24, marginSM:   12, marginXS:   8, marginXXS:  4,
  controlHeight: 32, controlHeightLG: 40, controlHeightSM: 24,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  motionDurationFast: '0.1s', motionDurationMid: '0.2s', motionDurationSlow: '0.3s',
}

const baseComponents = {
  Layout: {
    siderBg:      'var(--shell)',
    headerBg:     'var(--shell)',
    bodyBg:       'var(--canvas)',
    headerPadding: '0 24px',
    headerHeight:  64,
  },
  Menu: {
    itemHeight:       44,
    itemMarginBlock:  4,
    itemMarginInline: 8,
    itemPaddingInline: 16,
    iconSize:         18,
    collapsedIconSize: 18,
  },
  Card: {
    paddingLG:      24,
    borderRadiusLG: 12,
    headerFontSize: 16,
    headerFontSizeSM: 14,
  },
  Table: {
    headerBorderRadius: 8,
    cellPaddingBlock:   12,
    cellPaddingInline:  16,
  },
  Button: {
    borderRadius:       8,
    controlHeight:      36,
    controlHeightLG:    40,
    controlHeightSM:    32,
    paddingInline:      16,
    paddingInlineLG:    20,
    paddingInlineSM:    12,
    fontWeight:         500,
  },
  Input: {
    borderRadius:   8,
    controlHeight:  36,
    paddingInline:  12,
  },
  Select: {
    borderRadius:  8,
    controlHeight: 36,
  },
  DatePicker: {
    borderRadius:  8,
    controlHeight: 36,
  },
  Modal: {
    borderRadiusLG: 12,
  },
  Tooltip: {
    borderRadius: 6,
  },
  Tag: {
    borderRadiusSM: 4,
  },
}

function buildAntdConfig(tokens: TokenMap, isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...baseTokens,
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
    },
    components: {
      ...baseComponents,
      Layout: {
        ...baseComponents.Layout,
        siderBg: tokens.shell,
        headerBg: tokens.shell,
        bodyBg: tokens.canvas,
      },
      Menu: {
        ...baseComponents.Menu,
        darkItemBg:          tokens.shell,
        darkSubMenuItemBg:   tokens.shell,
        darkItemHoverBg:     tokens.hover,
        darkItemSelectedBg:  tokens.accentPrimary,
        darkItemSelectedColor: tokens.textInverse,
        itemSelectedBg:      tokens.accentPrimary,
        itemSelectedColor:   tokens.textInverse,
        itemHoverBg:         tokens.hover,
        itemActiveBg:        tokens.accentPrimarySoft,
      },
    },
  }
}

export const lightAntdConfig = buildAntdConfig(lightTokens, false)
export const darkAntdConfig  = buildAntdConfig(darkTokens, true)

export function getAntdConfig(mode: 'light' | 'dark'): ThemeConfig {
  return mode === 'dark' ? darkAntdConfig : lightAntdConfig
}

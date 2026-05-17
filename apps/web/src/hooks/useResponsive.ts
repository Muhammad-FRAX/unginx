import { Grid } from 'antd'

const { useBreakpoint } = Grid

export interface ResponsiveConfig {
  isMobile: boolean
  isTablet: boolean
  isLaptop: boolean
  isDesktop: boolean
  isUltrawide: boolean
  isMobileOrTablet: boolean
  isDesktopOrLarger: boolean
  contentPadding: number
  sectionGap: number
  cardPadding: number
  chartHeight: number
  chartHeightSmall: number
  chartHeightLarge: number
  kpiMinWidth: number
  kpiGap: number
  screens: ReturnType<typeof Grid.useBreakpoint>
}

export function useResponsive(): ResponsiveConfig {
  const screens = useBreakpoint()

  const isMobile     = !screens.md
  const isTablet     = !!screens.md && !screens.lg
  const isLaptop     = !!screens.lg && !screens.xl
  const isDesktop    = !!screens.xl && !screens.xxl
  const isUltrawide  = !!screens.xxl
  const isMobileOrTablet  = !screens.lg
  const isDesktopOrLarger = !!screens.xl

  const contentPadding = screens.xl ? 24 : screens.lg ? 20 : screens.md ? 16 : 12
  const sectionGap     = screens.lg ? 24 : screens.md ? 20 : 16
  const cardPadding    = screens.xl ? 24 : screens.lg ? 20 : screens.md ? 16 : 12

  const chartHeight      = screens.xxl ? 400 : screens.lg ? 300 : screens.md ? 250 : 200
  const chartHeightSmall = screens.xxl ? 350 : screens.lg ? 280 : screens.md ? 220 : 180
  const chartHeightLarge = screens.xxl ? 450 : screens.lg ? 350 : screens.md ? 280 : 220

  const kpiMinWidth = screens.xxl ? 240 : screens.xl ? 220 : screens.lg ? 200 : screens.md ? 180 : 160
  const kpiGap      = screens.lg ? 16 : screens.md ? 12 : 10

  return {
    isMobile, isTablet, isLaptop, isDesktop, isUltrawide,
    isMobileOrTablet, isDesktopOrLarger,
    contentPadding, sectionGap, cardPadding,
    chartHeight, chartHeightSmall, chartHeightLarge,
    kpiMinWidth, kpiGap, screens
  }
}

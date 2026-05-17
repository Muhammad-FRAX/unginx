import type { EChartsOption } from 'echarts'
import { lightTokens, darkTokens, type TokenMap } from './tokens.js'

type EChartsTheme = NonNullable<EChartsOption['color']> extends Array<infer T> ? T : never

interface ChartTheme {
  backgroundColor: string
  textColor: string
  axisLineColor: string
  splitLineColor: string
  tooltipBg: string
  tooltipBorder: string
  colors: string[]
}

function buildEChartsTheme(tokens: TokenMap): ChartTheme {
  return {
    backgroundColor: tokens.surface,
    textColor:       tokens.textMuted,
    axisLineColor:   tokens.borderSubtle,
    splitLineColor:  tokens.divider,
    tooltipBg:       tokens.elevated,
    tooltipBorder:   tokens.borderSubtle,
    colors: [
      tokens.accentPrimary,
      tokens.accentSecondary,
      tokens.statusSuccess,
      tokens.statusWarning,
      tokens.statusDanger,
      tokens.statusInfo,
    ],
  }
}

export function getEChartsTheme(mode: 'light' | 'dark'): ChartTheme {
  return buildEChartsTheme(mode === 'dark' ? darkTokens : lightTokens)
}

export function getEChartsBaseOption(mode: 'light' | 'dark'): EChartsOption {
  const t = getEChartsTheme(mode)
  return {
    backgroundColor: t.backgroundColor,
    color: t.colors as EChartsTheme[],
    textStyle: { color: t.textColor, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    grid: { containLabel: true },
    xAxis: {
      axisLine:  { lineStyle: { color: t.axisLineColor } },
      axisTick:  { lineStyle: { color: t.axisLineColor } },
      axisLabel: { color: t.textColor },
      splitLine: { lineStyle: { color: t.splitLineColor } },
    },
    yAxis: {
      axisLine:  { lineStyle: { color: t.axisLineColor } },
      axisTick:  { lineStyle: { color: t.axisLineColor } },
      axisLabel: { color: t.textColor },
      splitLine: { lineStyle: { color: t.splitLineColor } },
    },
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor:     t.tooltipBorder,
      textStyle:       { color: t.textColor },
    },
    legend: {
      textStyle: { color: t.textColor },
    },
  }
}

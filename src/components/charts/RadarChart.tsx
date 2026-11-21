import { memo, useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { RadarChart as RadarSeries } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { LifeStats } from '@/types'
import { STAT_KEYS, STAT_LABELS } from '@/types'

echarts.use([RadarSeries, TooltipComponent, LegendComponent, CanvasRenderer])

interface RadarChartProps {
  series: Array<{ name: string; stats: LifeStats }>
  height?: number
}

export const RadarChart = memo(function RadarChart({ series, height = 360 }: RadarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption({
      color: ['#17191C', '#BFC3C7'],
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: '#777777', fontSize: 11 },
      },
      radar: {
        indicator: STAT_KEYS.map((key) => ({ name: STAT_LABELS[key], max: 100 })),
        radius: '65%',
        splitNumber: 5,
        axisName: { color: '#777777', fontSize: 12 },
        splitLine: { lineStyle: { color: '#DDDDDA' } },
        splitArea: { areaStyle: { color: ['#FFFFFF', '#F5F5F3'] } },
        axisLine: { lineStyle: { color: '#DDDDDA' } },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 3,
          data: series.map((s, i) => ({
            name: s.name,
            value: STAT_KEYS.map((key) => s.stats[key]),
            symbol: i === 1 ? 'rect' : 'circle',
            symbolSize: i === 1 ? 4 : 3,
            lineStyle: { width: 1.5, type: i === 1 ? 'dashed' : 'solid' },
            areaStyle: { opacity: i === 0 ? 0.08 : 0.04 },
          })),
        },
      ],
    })
  }, [series])

  return <div ref={containerRef} style={{ height }} className="w-full" />
})
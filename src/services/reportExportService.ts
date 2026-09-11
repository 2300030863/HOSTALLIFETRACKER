import { format } from 'date-fns'
import type { Transaction, Attendance } from '@/types'

export interface PersonReportData {
  personName: string
  periodLabel: string
  totalGiven: number
  totalReceived: number
  netBalance: number // positive = owes user, negative = user owes person
  transactions: Transaction[]
}

export interface AttendanceReportData {
  periodLabel: string
  totalDays: number
  presentDays: number
  lateDays: number
  absentDays: number
  attendanceRate: number
  records: Attendance[]
}

export interface AllPeopleReportData {
  periodLabel: string
  totalOwedToUser: number
  totalUserOwes: number
  peopleBalances: Array<{
    name: string
    given: number
    received: number
    net: number
  }>
}

/**
 * Generates a high-resolution, beautifully styled PNG image report card using HTML5 Canvas
 */
export async function downloadReportImage(
  title: string,
  subtitle: string,
  personName: string,
  periodLabel: string,
  kpis: Array<{ label: string; value: string; color?: string }>,
  items: Array<{ col1: string; col2: string; col3: string; badgeColor?: string }>,
  footerBanner?: { text: string; isNegative?: boolean; isPositive?: boolean },
  filename: string = 'hostel_report.png'
): Promise<void> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // High DPI scaling (2x scale for sharp text)
  const scale = 2
  const width = 640
  // Dynamic height calculation based on item count
  const baseHeight = 440
  const itemHeight = 36
  const height = Math.max(520, baseHeight + items.length * itemHeight)

  canvas.width = width * scale
  canvas.height = height * scale
  ctx.scale(scale, scale)

  // 1. Background with sleek rounded dark gradient
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, '#0f172a') // Slate 900
  bgGradient.addColorStop(0.5, '#1e1b4b') // Indigo 950
  bgGradient.addColorStop(1, '#0f172a') // Slate 900

  ctx.fillStyle = bgGradient
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height, 28)
  ctx.fill()

  // Inner card background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(16, 16, width - 32, height - 32, 20)
  ctx.fill()
  ctx.stroke()

  // 2. Header Section
  ctx.textAlign = 'center'
  ctx.fillStyle = '#818cf8' // Indigo 400
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText('HOSTEL LIFE TRACKER', width / 2, 48)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(title.toUpperCase(), width / 2, 76)

  ctx.fillStyle = '#94a3b8' // Slate 400
  ctx.font = '12px sans-serif'
  ctx.fillText(subtitle, width / 2, 96)

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(36, 112)
  ctx.lineTo(width - 36, 112)
  ctx.stroke()

  // 3. Person & Date Info Bar
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(`👤 ${personName}`, 36, 138)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#cbd5e1'
  ctx.font = 'medium 13px sans-serif'
  ctx.fillText(`📅 ${periodLabel}`, width - 36, 138)

  // 4. KPI Summary Cards
  const kpiY = 160
  const kpiWidth = (width - 72 - (kpis.length - 1) * 12) / kpis.length

  kpis.forEach((kpi, idx) => {
    const kpiX = 36 + idx * (kpiWidth + 12)

    // KPI box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)' // Slate 800
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.beginPath()
    ctx.roundRect(kpiX, kpiY, kpiWidth, 68, 14)
    ctx.fill()
    ctx.stroke()

    // KPI Label
    ctx.textAlign = 'center'
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px sans-serif'
    ctx.fillText(kpi.label.toUpperCase(), kpiX + kpiWidth / 2, kpiY + 24)

    // KPI Value
    ctx.fillStyle = kpi.color || '#ffffff'
    ctx.font = 'bold 17px sans-serif'
    ctx.fillText(kpi.value, kpiX + kpiWidth / 2, kpiY + 50)
  })

  // Table Section Header
  const tableY = 252
  ctx.textAlign = 'left'
  ctx.fillStyle = '#818cf8'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText('TRANSACTION HISTORY LOG', 36, tableY)

  // Table Divider Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.beginPath()
  ctx.moveTo(36, tableY + 10)
  ctx.lineTo(width - 36, tableY + 10)
  ctx.stroke()

  // 5. Transaction Rows
  let currentY = tableY + 34
  if (items.length === 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#64748b'
    ctx.font = 'italic 13px sans-serif'
    ctx.fillText('No transactions recorded for this period.', width / 2, currentY + 10)
    currentY += 30
  } else {
    items.forEach((item, idx) => {
      // Alternate row bg
      if (idx % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
        ctx.beginPath()
        ctx.roundRect(32, currentY - 18, width - 64, 30, 8)
        ctx.fill()
      }

      // Column 1 (Date)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '12px sans-serif'
      ctx.fillText(item.col1, 44, currentY)

      // Column 2 (Category/Description)
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(item.col2, 140, currentY)

      // Column 3 (Amount)
      ctx.textAlign = 'right'
      ctx.fillStyle = item.badgeColor || '#ffffff'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(item.col3, width - 44, currentY)

      currentY += itemHeight
    })
  }

  // 6. Footer Banner (Status Summary)
  currentY += 10
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.beginPath()
  ctx.moveTo(36, currentY)
  ctx.lineTo(width - 36, currentY)
  ctx.stroke()

  currentY += 24
  if (footerBanner) {
    const bannerBg = footerBanner.isNegative
      ? 'rgba(225, 29, 72, 0.2)'
      : footerBanner.isPositive
      ? 'rgba(16, 185, 129, 0.2)'
      : 'rgba(99, 102, 241, 0.2)'

    const bannerBorder = footerBanner.isNegative
      ? '#f43f5e'
      : footerBanner.isPositive
      ? '#10b981'
      : '#6366f1'

    ctx.fillStyle = bannerBg
    ctx.strokeStyle = bannerBorder
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(36, currentY - 16, width - 72, 40, 12)
    ctx.fill()
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = footerBanner.isNegative
      ? '#fb7185'
      : footerBanner.isPositive
      ? '#34d399'
      : '#818cf8'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(footerBanner.text, width / 2, currentY + 9)
    currentY += 46
  }

  // Timestamp watermark at bottom
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.font = '10px sans-serif'
  ctx.fillText(
    `Generated by Hostel Life Tracker • ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`,
    width / 2,
    height - 24
  )

  // Download Trigger
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export report as CSV spreadsheet file
 */
export function downloadReportCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string = 'hostel_report.csv'
): void {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.map((cell) => `"${cell}"`).join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export report as PDF document
 */
export function downloadReportPDF(
  title: string,
  personName: string,
  periodLabel: string,
  kpis: Array<{ label: string; value: string }>,
  headers: string[],
  rows: (string | number)[][],
  footerText?: string,
  _filename: string = 'hostel_report.pdf'
): void {
  // Generate structured HTML print template for clean browser PDF saving
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - ${personName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #4338ca; font-size: 24px; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
          .meta { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-bottom: 16px; background: #f1f5f9; padding: 10px 16px; border-radius: 8px; }
          .kpis { display: flex; gap: 12px; margin-bottom: 20px; }
          .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center; }
          .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }
          .kpi-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background: #4338ca; color: white; padding: 8px 12px; text-align: left; }
          td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer-banner { background: #EEF2FF; border: 1px solid #6366f1; color: #3730a3; padding: 12px; border-radius: 8px; font-weight: bold; text-align: center; margin-top: 20px; }
          .watermark { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HOSTEL LIFE TRACKER</h1>
          <p>${title.toUpperCase()} — ${periodLabel}</p>
        </div>
        <div class="meta">
          <span>👤 ${personName}</span>
          <span>📅 Date: ${format(new Date(), 'dd MMM yyyy')}</span>
        </div>

        <div class="kpis">
          ${kpis.map((k) => `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-val">${k.value}</div></div>`).join('')}
        </div>

        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>

        ${footerText ? `<div class="footer-banner">${footerText}</div>` : ''}

        <div class="watermark">Generated automatically by Hostel Life Tracker</div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

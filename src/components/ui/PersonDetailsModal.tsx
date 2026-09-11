import { format } from 'date-fns'
import type { Person, Transaction } from '@/types'
import { X, Download, FileText, Table, Phone, CheckCircle2 } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'
import {
  downloadReportImage,
  downloadReportPDF,
  downloadReportCSV,
} from '@/services/reportExportService'

interface PersonDetailsModalProps {
  isOpen: boolean
  person: Person | null
  transactions: Transaction[]
  onClose: () => void
  onSettleUp: (personName: string, amount: number) => void
}

export function PersonDetailsModal({
  isOpen,
  person,
  transactions,
  onClose,
  onSettleUp,
}: PersonDetailsModalProps) {
  if (!isOpen || !person) return null

  // Filter transactions specifically for THIS PERSON ONLY (check person_id, person_name, and description)
  const targetName = person.name.toLowerCase().trim()
  const personTxs = transactions.filter(
    (t) =>
      t.person_id === person.id ||
      (t.person_name && t.person_name.toLowerCase().trim() === targetName) ||
      (t.description && t.description.toLowerCase().includes(targetName))
  )

  const given = personTxs
    .filter((t) => t.type === 'given')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const received = personTxs
    .filter((t) => t.type === 'received')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const net = given - received
  const periodLabel = format(new Date(), 'MMMM yyyy')

  // Export handlers for THIS PERSON ONLY
  const handleDownloadImage = async () => {
    try {
      const kpis = [
        { label: 'Total Given', value: `₹${given.toLocaleString()}`, color: '#38bdf8' },
        { label: 'Total Received', value: `₹${received.toLocaleString()}`, color: '#4ade80' },
        {
          label: 'Pending Balance',
          value: `₹${Math.abs(net).toLocaleString()}`,
          color: net > 0 ? '#f43f5e' : net < 0 ? '#4ade80' : '#94a3b8',
        },
      ]

      const items = personTxs.map((t) => ({
        col1: t.transaction_date ? format(new Date(t.transaction_date), 'dd MMM') : 'N/A',
        col2: `${t.type === 'given' ? 'Given' : t.type === 'received' ? 'Received' : t.category}${t.description ? ` (${t.description})` : ''}`,
        col3: `${t.type === 'given' ? '+' : '-'}₹${Number(t.amount).toLocaleString()}`,
        badgeColor: t.type === 'given' ? '#38bdf8' : '#4ade80',
      }))

      const footerText =
        net > 0
          ? `🔴 ${person.name} owes you ₹${Math.abs(net).toLocaleString()}`
          : net < 0
          ? `🟢 You owe ${person.name} ₹${Math.abs(net).toLocaleString()}`
          : `✅ Account with ${person.name} is fully settled up!`

      await downloadReportImage(
        'MONEY REPORT',
        `Transaction Statement for ${person.name}`,
        person.name,
        periodLabel,
        kpis,
        items,
        {
          text: footerText,
          isNegative: net > 0,
          isPositive: net < 0,
        },
        `${person.name.replaceAll(' ', '_')}_Money_Report.png`
      )

      showToast.success(`Downloaded ${person.name}'s Report Card Image! 📥`)
    } catch (err) {
      console.error(err)
      showToast.error('Failed to generate report image')
    }
  }

  const handleDownloadPDF = () => {
    try {
      const kpis = [
        { label: 'Total Given', value: `₹${given.toLocaleString()}` },
        { label: 'Total Received', value: `₹${received.toLocaleString()}` },
        { label: 'Net Balance', value: `₹${Math.abs(net).toLocaleString()}` },
      ]

      const headers = ['Date', 'Type', 'Description / Purpose', 'Amount']
      const rows = personTxs.map((t) => [
        t.transaction_date,
        t.type.toUpperCase(),
        t.description || t.category || '-',
        `₹${Number(t.amount).toLocaleString()}`,
      ])

      const footerText =
        net > 0
          ? `${person.name} owes you ₹${Math.abs(net).toLocaleString()}`
          : net < 0
          ? `You owe ${person.name} ₹${Math.abs(net).toLocaleString()}`
          : `Account with ${person.name} is fully settled!`

      downloadReportPDF(
        `MONEY STATEMENT - ${person.name}`,
        person.name,
        periodLabel,
        kpis,
        headers,
        rows,
        footerText,
        `${person.name.replaceAll(' ', '_')}_Statement.pdf`
      )
    } catch (err) {
      showToast.error('Failed to generate PDF statement')
    }
  }

  const handleDownloadCSV = () => {
    if (personTxs.length === 0) {
      showToast.error(`No transactions recorded for ${person.name}`)
      return
    }

    const headers = ['Date', 'Type', 'Person', 'Amount', 'Payment Method', 'Description']
    const rows = personTxs.map((t) => [
      t.transaction_date,
      t.type,
      person.name,
      t.amount,
      t.payment_method,
      t.description || '',
    ])

    downloadReportCSV(
      headers,
      rows,
      `${person.name.replaceAll(' ', '_')}_Transactions.csv`
    )
    showToast.success(`Exported ${person.name}'s transactions as CSV! 📊`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-surface-950/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold text-lg uppercase shadow-md shadow-primary-600/30">
              {person.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-base text-surface-900 dark:text-white leading-tight">
                {person.name}
              </h3>
              {person.phone && (
                <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                  <Phone size={12} />
                  <span>{person.phone}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 text-center">
              <p className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">Total Given</p>
              <p className="text-base font-extrabold text-sky-700 dark:text-sky-300 mt-0.5">
                ₹{given.toLocaleString()}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Total Received</p>
              <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                ₹{received.toLocaleString()}
              </p>
            </div>

            <div
              className={`p-3 rounded-2xl border text-center ${
                net > 0
                  ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/40'
                  : net < 0
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40'
                  : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700'
              }`}
            >
              <p className="text-[10px] font-bold uppercase text-surface-500">
                {net > 0 ? 'Owes You' : net < 0 ? 'You Owe' : 'Balance'}
              </p>
              <p
                className={`text-base font-extrabold mt-0.5 ${
                  net > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : net < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-surface-600 dark:text-surface-300'
                }`}
              >
                ₹{Math.abs(net).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Settle Up Action Button */}
          {net !== 0 && (
            <button
              onClick={() => onSettleUp(person.name, net)}
              className="w-full py-2.5 px-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>Settle Up Full Balance (₹{Math.abs(net).toLocaleString()})</span>
            </button>
          )}

          {/* Export Report Actions Toolbar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-900/90 to-indigo-900/90 text-white space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary-200">📥 Export {person.name}'s Report</span>
              <span className="text-[10px] text-primary-300">Single Person Only</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleDownloadImage}
                className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 backdrop-blur-md"
                title="Download single person report as a PNG image"
              >
                <Download size={14} />
                <span>PNG Image</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 backdrop-blur-md"
                title="Download single person report as PDF"
              >
                <FileText size={14} />
                <span>PDF Statement</span>
              </button>

              <button
                onClick={handleDownloadCSV}
                className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 backdrop-blur-md"
                title="Export transactions as CSV"
              >
                <Table size={14} />
                <span>CSV Sheet</span>
              </button>
            </div>
          </div>

          {/* Person Transactions List */}
          <div>
            <h4 className="font-bold text-xs text-surface-500 uppercase tracking-wide mb-3">
              Transaction History ({personTxs.length})
            </h4>

            {personTxs.length === 0 ? (
              <div className="text-center py-8 text-surface-400 text-xs rounded-2xl bg-surface-50 dark:bg-surface-800/40">
                No transactions recorded for {person.name}.
              </div>
            ) : (
              <div className="space-y-2">
                {personTxs.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-100 dark:border-surface-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            t.type === 'given'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {t.type}
                        </span>
                        <span className="text-xs font-bold text-surface-900 dark:text-white">
                          {t.description || t.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        {t.transaction_date} • {t.payment_method.toUpperCase()}
                      </p>
                    </div>

                    <span
                      className={`text-sm font-extrabold ${
                        t.type === 'given'
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {t.type === 'given' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

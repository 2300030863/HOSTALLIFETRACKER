import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { placementService, subscribeToRealtime, isPlacementDeleted } from '@/services/dbServices'
import { supabase } from '@/services/supabase'
import type { PlacementApplication, PlacementStatus } from '@/types'
import {
  GraduationCap,
  Plus,
  Search,
  ExternalLink,
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  IndianRupee,
  FileText,
  Trash2,
  Pencil,
  Eye,
  AlertCircle,
  Sparkles,
  Bell,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'

// Status configuration with color schemes & icons
const STATUS_CONFIG: Record<
  PlacementStatus,
  { label: string; bg: string; text: string; border: string; dot: string; icon: string }
> = {
  registered: {
    label: 'Registered',
    bg: 'bg-slate-100 dark:bg-slate-900/60',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    icon: '📝',
  },
  applied: {
    label: 'Applied',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    icon: '📤',
  },
  test: {
    label: 'Online Test',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    icon: '💻',
  },
  interview: {
    label: 'Interview',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
    icon: '🎯',
  },
  selected: {
    label: 'Selected / Offer',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    icon: '🎉',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    icon: '✕',
  },
  withdrawn: {
    label: 'Withdrawn',
    bg: 'bg-surface-100 dark:bg-surface-800',
    text: 'text-surface-600 dark:text-surface-400',
    border: 'border-surface-300 dark:border-surface-700',
    dot: 'bg-surface-400',
    icon: '⊘',
  },
}

export default function PlacementsPage() {
  const [placements, setPlacements] = useState<PlacementApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PlacementStatus>('all')

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingPlacement, setEditingPlacement] = useState<PlacementApplication | null>(null)
  const [viewingPlacement, setViewingPlacement] = useState<PlacementApplication | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    company_name: '',
    job_role: '',
    application_date: '',
    application_deadline: '',
    status: 'applied' as PlacementStatus,
    job_url: '',
    location: '',
    ctc: '',
    eligibility: '',
    test_date: '',
    interview_date: '',
    follow_up_date: '',
    contact_name: '',
    contact_email: '',
    resume_version: '',
    notes: '',
    auto_reminders: true,
  })

  // Load placements
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await placementService.getAllPlacements()
      setPlacements(data)
    } catch (err) {
      console.error('Failed to load placements:', err)
      showToast.error('Failed to load placement applications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // 1. Listen to database table realtime changes
    const unsubscribe = subscribeToRealtime(() => {
      loadData()
    })

    // 2. Listen to instant cross-device broadcast messages (e.g. deletions on another device)
    const broadcastChannel = supabase
      .channel('ht_placements_broadcast')
      .on('broadcast', { event: 'placements_changed' }, (msg) => {
        if (msg?.payload?.deletedIds && Array.isArray(msg.payload.deletedIds)) {
          const sigs = msg.payload.deletedIds as string[]
          setPlacements((prev) => prev.filter((p) => !isPlacementDeleted(p, sigs)))
        }
        loadData()
      })
      .subscribe()

    // 3. Auto-sync whenever user focuses or switches back to this tab/app on any device
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }
    const handleFocus = () => {
      loadData()
    }
    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    // 4. Polling interval every 6s while page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }, 6000)

    return () => {
      unsubscribe()
      supabase.removeChannel(broadcastChannel)
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [loadData])

  // Reset form
  const handleOpenAdd = () => {
    setEditingPlacement(null)
    setFormData({
      company_name: '',
      job_role: '',
      application_date: new Date().toISOString().slice(0, 10),
      application_deadline: '',
      status: 'applied',
      job_url: '',
      location: '',
      ctc: '',
      eligibility: '',
      test_date: '',
      interview_date: '',
      follow_up_date: '',
      contact_name: '',
      contact_email: '',
      resume_version: '',
      notes: '',
      auto_reminders: true,
    })
    setIsFormModalOpen(true)
  }

  const handleOpenEdit = (p: PlacementApplication) => {
    setEditingPlacement(p)
    setFormData({
      company_name: p.company_name,
      job_role: p.job_role,
      application_date: p.application_date || '',
      application_deadline: p.application_deadline || '',
      status: p.status,
      job_url: p.job_url || '',
      location: p.location || '',
      ctc: p.ctc || '',
      eligibility: p.eligibility || '',
      test_date: p.test_date ? p.test_date.slice(0, 16) : '',
      interview_date: p.interview_date ? p.interview_date.slice(0, 16) : '',
      follow_up_date: p.follow_up_date ? p.follow_up_date.slice(0, 16) : '',
      contact_name: p.contact_name || '',
      contact_email: p.contact_email || '',
      resume_version: p.resume_version || '',
      notes: p.notes || '',
      auto_reminders: true,
    })
    setIsFormModalOpen(true)
  }

  // Save Application
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.company_name.trim() || !formData.job_role.trim()) {
      showToast.error('Please enter Company Name and Job Role')
      return
    }

    try {
      const payload = {
        company_name: formData.company_name.trim(),
        job_role: formData.job_role.trim(),
        application_date: formData.application_date || null,
        application_deadline: formData.application_deadline || null,
        status: formData.status,
        job_url: formData.job_url.trim() || null,
        location: formData.location.trim() || null,
        ctc: formData.ctc.trim() || null,
        eligibility: formData.eligibility.trim() || null,
        test_date: formData.test_date ? new Date(formData.test_date).toISOString() : null,
        interview_date: formData.interview_date ? new Date(formData.interview_date).toISOString() : null,
        follow_up_date: formData.follow_up_date ? new Date(formData.follow_up_date).toISOString() : null,
        contact_name: formData.contact_name.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        resume_version: formData.resume_version.trim() || null,
        notes: formData.notes.trim() || null,
      }

      if (editingPlacement) {
        await placementService.updatePlacement(editingPlacement.id, payload, formData.auto_reminders)
        showToast.success(`Updated ${formData.company_name} application`)
      } else {
        await placementService.createPlacement(payload, formData.auto_reminders)
        showToast.success(`Added ${formData.company_name} application`)
      }

      setIsFormModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Save placement error:', err)
      showToast.error('Could not save application')
    }
  }

  // Quick Status change
  const handleQuickStatusChange = async (id: string, newStatus: PlacementStatus) => {
    try {
      await placementService.updatePlacement(id, { status: newStatus })
      setPlacements((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      )
      showToast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`)
    } catch (err) {
      console.error(err)
      showToast.error('Failed to update status')
    }
  }

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const target = placements.find((p) => p.id === id)
      await placementService.deletePlacement(id, target?.company_name, target?.job_role)
      setPlacements((prev) =>
        prev.filter(
          (p) =>
            p.id !== id &&
            (!target?.company_name || p.company_name.toLowerCase().trim() !== target.company_name.toLowerCase().trim())
        )
      )
      setDeletingId(null)
      if (viewingPlacement?.id === id) setViewingPlacement(null)
      showToast.success('Application deleted')
    } catch (err) {
      console.error(err)
      showToast.error('Failed to delete')
    }
  }

  // Filtered applications
  const filteredPlacements = placements.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      p.company_name.toLowerCase().includes(q) ||
      p.job_role.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      (p.ctc && p.ctc.toLowerCase().includes(q))
    return matchesStatus && matchesSearch
  })

  // Summary counts
  const totalCount = placements.length
  const appliedCount = placements.filter((p) => p.status === 'applied').length
  const testCount = placements.filter((p) => p.status === 'test').length
  const interviewCount = placements.filter((p) => p.status === 'interview').length
  const selectedCount = placements.filter((p) => p.status === 'selected').length

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return dateStr
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Top Header & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-primary-600 text-white shadow-lg shadow-indigo-500/25">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-surface-900 dark:text-white flex items-center gap-2">
                  <span>Placement & Job Applications</span>
                </h1>
                <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400">
                  Track campus drives, tests, interviews & auto-reminders
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await loadData()
                showToast.success('Placements synced across devices')
              }}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] text-surface-600 dark:text-surface-300 font-bold text-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Sync placements with cloud across devices"
            >
              <RefreshCw size={16} className={cn(loading && 'animate-spin text-primary-500')} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-primary-600/30 hover:shadow-primary-600/50 hover:scale-102 active:scale-98 transition-all cursor-pointer"
            >
              <Plus size={18} />
              <span>Add Application</span>
            </button>
          </div>
        </div>

        {/* Stats Summary KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            onClick={() => setStatusFilter('all')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              statusFilter === 'all'
                ? 'bg-primary-50/80 dark:bg-primary-950/40 border-primary-300 dark:border-primary-700 ring-2 ring-primary-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300'
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Total Applications</p>
            <p className="text-2xl font-black text-surface-900 dark:text-white mt-1">{totalCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('applied')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              statusFilter === 'applied'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300'
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Applied</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{appliedCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('test')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              statusFilter === 'test'
                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300'
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Online Tests</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{testCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('interview')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              statusFilter === 'interview'
                ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300'
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Interviews</p>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{interviewCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('selected')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1',
              statusFilter === 'selected'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300'
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Selected 🎉</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{selectedCount}</p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-surface-900/60 p-3 rounded-2xl border border-surface-200/80 dark:border-white/[0.06] backdrop-blur-xl">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, role, location, CTC..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          {/* Status Filter Scroll / Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                statusFilter === 'all'
                  ? 'bg-surface-900 text-white dark:bg-white dark:text-surface-900'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300'
              )}
            >
              All ({totalCount})
            </button>
            {(['applied', 'test', 'interview', 'selected', 'registered', 'rejected'] as PlacementStatus[]).map(
              (st) => {
                const count = placements.filter((p) => p.status === st).length
                return (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer',
                      statusFilter === st
                        ? 'bg-primary-600 text-white font-bold shadow-sm'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300'
                    )}
                  >
                    <span>{STATUS_CONFIG[st].icon}</span>
                    <span>{STATUS_CONFIG[st].label}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                )
              }
            )}
          </div>
        </div>

        {/* Application Cards List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white/50 dark:bg-surface-900/50 rounded-3xl border border-surface-200/60 dark:border-white/[0.06]">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            <p className="text-xs text-surface-500 font-medium">Loading placement applications...</p>
          </div>
        ) : filteredPlacements.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-surface-900 rounded-3xl border border-dashed border-surface-200 dark:border-surface-800 p-8">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mb-3 shadow-inner">
              🎓
            </div>
            <h3 className="text-base font-bold text-surface-900 dark:text-white">
              No placement applications found
            </h3>
            <p className="text-xs text-surface-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Start tracking campus placements, online assessments, and interview rounds!'}
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-all cursor-pointer shadow-md shadow-primary-600/25"
            >
              + Add First Application
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlacements.map((item) => {
              const cfg = STATUS_CONFIG[item.status]
              return (
                <div
                  key={item.id}
                  className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-indigo-300 dark:hover:border-indigo-700/60"
                >
                  <div>
                    {/* Top Row: Company & Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-700 border border-surface-200/60 dark:border-surface-700 flex items-center justify-center font-black text-lg text-primary-600 dark:text-primary-400 shadow-sm">
                          {item.company_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {item.company_name}
                          </h3>
                          <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1.5 mt-0.5">
                            <Briefcase size={13} className="text-surface-400 shrink-0" />
                            <span>{item.job_role}</span>
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 shrink-0',
                          cfg.bg,
                          cfg.text,
                          cfg.border
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                        <span>{cfg.label}</span>
                      </span>
                    </div>

                    {/* Metadata Badges: CTC, Location, Eligibility */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 mt-1 text-xs">
                      {item.ctc && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                          <IndianRupee size={12} />
                          <span>{item.ctc}</span>
                        </span>
                      )}

                      {item.location && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 font-medium">
                          <MapPin size={12} className="text-surface-400" />
                          <span>{item.location}</span>
                        </span>
                      )}

                      {item.resume_version && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">
                          <FileText size={11} />
                          <span>{item.resume_version}</span>
                        </span>
                      )}
                    </div>

                    {/* Important Schedule Badges */}
                    <div className="space-y-1.5 bg-surface-50 dark:bg-surface-800/40 rounded-2xl p-3 border border-surface-100 dark:border-surface-800/80 mb-3 text-xs">
                      {item.application_date && (
                        <div className="flex items-center justify-between text-surface-600 dark:text-surface-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar size={13} className="text-surface-400" />
                            Applied:
                          </span>
                          <span className="font-semibold text-surface-800 dark:text-surface-200">
                            {formatDate(item.application_date)}
                          </span>
                        </div>
                      )}

                      {item.application_deadline && (
                        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <AlertCircle size={13} />
                            Deadline:
                          </span>
                          <span className="font-bold">{formatDate(item.application_deadline)}</span>
                        </div>
                      )}

                      {item.test_date && (
                        <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold bg-amber-100/60 dark:bg-amber-950/60 p-1.5 rounded-xl border border-amber-200 dark:border-amber-900/60">
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="animate-pulse" />
                            Online Test:
                          </span>
                          <span>{formatDateTime(item.test_date)}</span>
                        </div>
                      )}

                      {item.interview_date && (
                        <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 font-bold bg-purple-100/60 dark:bg-purple-950/60 p-1.5 rounded-xl border border-purple-200 dark:border-purple-900/60">
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={13} className="animate-pulse" />
                            Interview:
                          </span>
                          <span>{formatDateTime(item.interview_date)}</span>
                        </div>
                      )}

                      {item.follow_up_date && !item.test_date && !item.interview_date && (
                        <div className="flex items-center justify-between text-surface-600 dark:text-surface-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Bell size={13} className="text-surface-400" />
                            Follow-up:
                          </span>
                          <span className="font-semibold text-surface-800 dark:text-surface-200">
                            {formatDate(item.follow_up_date)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notes preview */}
                    {item.notes && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 italic mb-3">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-800 mt-2">
                    <div className="flex items-center gap-1.5">
                      {/* View Details */}
                      <button
                        onClick={() => setViewingPlacement(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 text-xs font-semibold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title="View Full Details"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 text-xs font-semibold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Edit Application"
                      >
                        <Pencil size={13} />
                        <span>Edit</span>
                      </button>

                      {/* Job Portal Link */}
                      {item.job_url && (
                        <a
                          href={item.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors cursor-pointer"
                          title="Open Careers / Portal"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="p-1.5 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Application"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ======================================================== */}
        {/* ADD / EDIT PLACEMENT APPLICATION MODAL                   */}
        {/* ======================================================== */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsFormModalOpen(false)}
            />
            <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-white/[0.08] shadow-2xl p-6 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-surface-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                    <GraduationCap size={18} />
                  </div>
                  <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                    {editingPlacement ? 'Edit Placement Application' : 'Add Placement Application'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-1.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* Company Name & Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="e.g. TCS, Infosys, Google"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Job Role *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.job_role}
                      onChange={(e) => setFormData({ ...formData, job_role: e.target.value })}
                      placeholder="e.g. Software Engineer, SDE-1"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Status & CTC */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Current Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as PlacementStatus })}
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    >
                      <option value="registered">Registered</option>
                      <option value="applied">Applied</option>
                      <option value="test">Online Test</option>
                      <option value="interview">Interview</option>
                      <option value="selected">Selected / Offer</option>
                      <option value="rejected">Rejected</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Package / CTC
                    </label>
                    <input
                      type="text"
                      value={formData.ctc}
                      onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
                      placeholder="e.g. ₹8.5 LPA or 35k/mo"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Location & Job URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Bengaluru, Remote, On-Campus"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Job / Portal Link
                    </label>
                    <input
                      type="url"
                      value={formData.job_url}
                      onChange={(e) => setFormData({ ...formData, job_url: e.target.value })}
                      placeholder="https://careers.example.com/job/123"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Dates Section */}
                <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/80 dark:border-surface-700/80 space-y-3">
                  <p className="font-bold text-surface-800 dark:text-surface-200 flex items-center gap-1.5 text-xs">
                    <Calendar size={13} className="text-primary-500" />
                    <span>Key Dates & Schedule</span>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-surface-600 dark:text-surface-400 mb-1">
                        Application Date
                      </label>
                      <input
                        type="date"
                        value={formData.application_date}
                        onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-surface-600 dark:text-surface-400 mb-1">
                        Application Deadline
                      </label>
                      <input
                        type="date"
                        value={formData.application_deadline}
                        onChange={(e) => setFormData({ ...formData, application_deadline: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-amber-600 dark:text-amber-400 mb-1">
                        Online Assessment / Test Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.test_date}
                        onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-purple-600 dark:text-purple-400 mb-1">
                        Interview Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.interview_date}
                        onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-surface-600 dark:text-surface-400 mb-1">
                      Follow-up Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.follow_up_date}
                      onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Eligibility & Resume Version */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Eligibility (CGPA, Branch)
                    </label>
                    <input
                      type="text"
                      value={formData.eligibility}
                      onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                      placeholder="e.g. CGPA >= 7.5, CSE/IT only"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Resume Version
                    </label>
                    <input
                      type="text"
                      value={formData.resume_version}
                      onChange={(e) => setFormData({ ...formData, resume_version: e.target.value })}
                      placeholder="e.g. Resume_SDE_v2.pdf"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Recruiter Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="HR Name"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="hr@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-bold text-surface-700 dark:text-surface-300 mb-1">
                    Notes & Preparation Tips
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Topics to revise, rounds breakdown, referal source..."
                    className="w-full px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                  />
                </div>

                {/* Automatic Reminders Checkbox */}
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/40">
                  <input
                    type="checkbox"
                    id="auto_reminders"
                    checked={formData.auto_reminders}
                    onChange={(e) => setFormData({ ...formData, auto_reminders: e.target.checked })}
                    className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <label htmlFor="auto_reminders" className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 cursor-pointer">
                    🔔 Automatically schedule alarms & reminders (1 hr before online test, interview, and follow-up)
                  </label>
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-bold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-bold shadow-md shadow-primary-600/30 hover:scale-102 active:scale-98 transition-all cursor-pointer"
                  >
                    {editingPlacement ? 'Save Changes' : 'Create Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW DETAILS MODAL                                       */}
        {/* ======================================================== */}
        {viewingPlacement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setViewingPlacement(null)}
            />
            <div className="relative z-10 w-full max-w-lg bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-white/[0.08] shadow-2xl p-6 animate-scale-in">
              <div className="flex items-start justify-between pb-3 border-b border-surface-100 dark:border-surface-800 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-primary-600/20">
                    {viewingPlacement.company_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-surface-900 dark:text-white">
                      {viewingPlacement.company_name}
                    </h3>
                    <p className="text-xs font-semibold text-surface-500">{viewingPlacement.job_role}</p>
                  </div>
                </div>

                <button
                  onClick={() => setViewingPlacement(null)}
                  className="p-1.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status & Quick Change */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/60 dark:border-surface-700/60 mb-4 text-xs">
                <span className="font-bold text-surface-600 dark:text-surface-400">Current Status:</span>
                <select
                  value={viewingPlacement.status}
                  onChange={(e) => {
                    const nextSt = e.target.value as PlacementStatus
                    handleQuickStatusChange(viewingPlacement.id, nextSt)
                    setViewingPlacement({ ...viewingPlacement, status: nextSt })
                  }}
                  className="px-2.5 py-1 rounded-xl font-bold bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white outline-none cursor-pointer"
                >
                  <option value="registered">Registered</option>
                  <option value="applied">Applied</option>
                  <option value="test">Online Test</option>
                  <option value="interview">Interview</option>
                  <option value="selected">Selected / Offer</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              {/* Details List */}
              <div className="space-y-2.5 text-xs text-surface-700 dark:text-surface-300 mb-5">
                {viewingPlacement.ctc && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-surface-500">Package / CTC:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{viewingPlacement.ctc}</span>
                  </div>
                )}

                {viewingPlacement.location && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-surface-500">Location:</span>
                    <span className="font-semibold">{viewingPlacement.location}</span>
                  </div>
                )}

                {viewingPlacement.eligibility && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-surface-500">Eligibility:</span>
                    <span className="font-semibold">{viewingPlacement.eligibility}</span>
                  </div>
                )}

                {viewingPlacement.resume_version && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-surface-500">Submitted Resume:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{viewingPlacement.resume_version}</span>
                  </div>
                )}

                {viewingPlacement.application_date && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-surface-500">Application Date:</span>
                    <span className="font-semibold">{formatDate(viewingPlacement.application_date)}</span>
                  </div>
                )}

                {viewingPlacement.application_deadline && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-rose-500 font-bold">Deadline:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{formatDate(viewingPlacement.application_deadline)}</span>
                  </div>
                )}

                {viewingPlacement.test_date && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-amber-600 font-bold">Online Test:</span>
                    <span className="font-bold text-amber-600">{formatDateTime(viewingPlacement.test_date)}</span>
                  </div>
                )}

                {viewingPlacement.interview_date && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-purple-600 font-bold">Interview:</span>
                    <span className="font-bold text-purple-600">{formatDateTime(viewingPlacement.interview_date)}</span>
                  </div>
                )}

                {viewingPlacement.contact_name && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-100 dark:border-surface-800">
                    <span className="text-surface-500">Recruiter Contact:</span>
                    <span className="font-semibold">
                      {viewingPlacement.contact_name} {viewingPlacement.contact_email ? `(${viewingPlacement.contact_email})` : ''}
                    </span>
                  </div>
                )}

                {viewingPlacement.notes && (
                  <div className="pt-2">
                    <span className="text-surface-500 block mb-1 font-bold">Notes & Strategy:</span>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-800/70 border border-surface-200/50 dark:border-surface-700/50 italic text-surface-800 dark:text-surface-200">
                      {viewingPlacement.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-800">
                <button
                  onClick={() => {
                    const toEdit = viewingPlacement
                    setViewingPlacement(null)
                    handleOpenEdit(toEdit)
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-bold text-xs hover:bg-surface-200 transition-colors cursor-pointer"
                >
                  Edit Details
                </button>

                {viewingPlacement.job_url ? (
                  <a
                    href={viewingPlacement.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 transition-colors shadow-md shadow-primary-600/25 cursor-pointer"
                  >
                    <span>Visit Careers Portal</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <button
                    onClick={() => setViewingPlacement(null)}
                    className="px-4 py-2 rounded-xl bg-surface-900 text-white dark:bg-white dark:text-surface-900 font-bold text-xs cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setDeletingId(null)}
            />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-white/[0.08] shadow-2xl p-6 text-center animate-scale-in">
              <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
                <Trash2 size={24} />
              </div>
              <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                Delete Application?
              </h3>
              <p className="text-xs text-surface-500 mt-1 mb-5">
                This will remove the placement record and its associated data from your dashboard.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-bold text-xs hover:bg-surface-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/30 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

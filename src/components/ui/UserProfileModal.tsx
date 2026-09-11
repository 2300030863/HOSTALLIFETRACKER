import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { X, User, Mail, Phone, Building2, Home, GraduationCap, Save, Check } from 'lucide-react'
import { showToast } from './Toast'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, profile, updateProfile, refreshProfile } = useAuth()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [hostelName, setHostelName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFullName(profile?.full_name || user?.user_metadata?.full_name || '')
      setPhone(profile?.phone || '')
      setHostelName(profile?.hostel_name || '')
      setRoomNumber(profile?.room_number || '')
      setCollegeName(profile?.college_name || '')
    }
  }, [isOpen, profile, user])

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        hostel_name: hostelName.trim() || null,
        room_number: roomNumber.trim() || null,
        college_name: collegeName.trim() || null,
      })

      if (error) {
        showToast.error(error)
      } else {
        await refreshProfile()
        showToast.success('Profile updated successfully! ✨')
        onClose()
      }
    } catch {
      showToast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600/10 text-primary-600 dark:text-primary-400 font-bold">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">Account Profile</h2>
              <p className="text-xs text-surface-500">View and update your profile details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-surface-400 hover:bg-surface-200/50 dark:hover:bg-surface-800 transition-colors cursor-pointer border-0 outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Registered Email (Read-Only) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
              <Mail size={14} className="text-primary-500" />
              <span>Registered Email Address</span>
            </label>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-100/70 dark:bg-surface-800/60 text-sm font-medium text-surface-800 dark:text-surface-200 border border-surface-200/60 dark:border-surface-700/50">
              <span className="truncate">{user?.email || profile?.email || 'N/A'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={10} /> Verified
              </span>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
              <User size={14} className="text-indigo-500" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
              <Phone size={14} className="text-blue-500" />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Hostel Name & Room Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
                <Building2 size={14} className="text-purple-500" />
                <span>Hostel Name</span>
              </label>
              <input
                type="text"
                value={hostelName}
                onChange={(e) => setHostelName(e.target.value)}
                placeholder="e.g. Block A"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
                <Home size={14} className="text-amber-500" />
                <span>Room Number</span>
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 302"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* College Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
              <GraduationCap size={14} className="text-rose-500" />
              <span>College / University</span>
            </label>
            <input
              type="text"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              placeholder="e.g. ABC Institute of Technology"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Footer Save Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-primary-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer border-0 outline-none"
            >
              <Save size={16} />
              <span>{saving ? 'Saving Profile...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

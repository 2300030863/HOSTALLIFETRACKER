// @ts-nocheck
// Supabase Edge Function: check-reminders
// Background Cron: Checks scheduled reminders & attendance window and sends Web Push notifications
// Can be invoked by Supabase pg_cron, cron-job.org, or scheduled webhooks every 1 to 5 minutes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@hosteltracker.app'

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured in Edge Function secrets.')
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Current time in IST (UTC + 5:30)
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)
    const todayStr = istTime.toISOString().split('T')[0]
    const hours = istTime.getUTCHours()
    const minutes = istTime.getUTCMinutes()
    const currentHHMM = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

    let sentCount = 0

    // 1. Check Due User Reminders
    const { data: dueReminders } = await supabaseAdmin
      .from('reminders')
      .select('*')
      .eq('completed', false)
      .eq('reminder_date', todayStr)
      .lte('reminder_time', currentHHMM)

    if (dueReminders && dueReminders.length > 0) {
      for (const reminder of dueReminders) {
        // Check if notification already logged today
        const notificationKey = `reminder-${reminder.id}-${todayStr}-${reminder.reminder_time}`
        const { data: existing } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', reminder.user_id)
          .eq('notification_key', notificationKey)
          .maybeSingle()

        if (!existing) {
          // Log notification in database
          await supabaseAdmin.from('notifications').insert({
            user_id: reminder.user_id,
            type: 'reminder',
            title: `🔔 Reminder: ${reminder.title}`,
            message: reminder.description || `It's ${reminder.reminder_time}!`,
            scheduled_at: now.toISOString(),
            notification_key: notificationKey,
            read: false,
          })

          // Send push to user devices
          const { data: subs } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', reminder.user_id)

          if (subs && subs.length > 0) {
            const payload = JSON.stringify({
              title: `🔔 Reminder: ${reminder.title}`,
              body: reminder.description || `It's ${reminder.reminder_time}!`,
              url: '/reminders',
              tag: `reminder-${reminder.id}-${todayStr}`,
            })

            for (const sub of subs) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                )
                sentCount++
              } catch (e: any) {
                if (e?.statusCode === 410 || e?.statusCode === 404) {
                  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                }
              }
            }
          }
        }
      }
    }

    // 2. Check Attendance Window: 9:00 PM to 10:00 PM IST (hours === 21), Every 10 Minutes
    if (hours === 21) {
      const slotMin = Math.floor(minutes / 10) * 10
      const slotHHMM = `21:${String(slotMin).padStart(2, '0')}`
      const notificationKey = `attendance-${todayStr}-${slotHHMM}`
      const isFinal = slotMin === 50

      const title = isFinal ? '🖐️ Final Attendance Reminder!' : '🖐️ Attendance Reminder'
      const message = isFinal
        ? "Today's attendance window closes in 10 minutes (10:00 PM)! Please submit your attendance now."
        : `Please submit today's hostel attendance! The window is open (9:00 PM – 10:00 PM). Slot: ${slotHHMM}.`

      const { data: allSubs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth')

      if (allSubs && allSubs.length > 0) {
        const userSubsMap: Record<string, typeof allSubs> = {}
        for (const sub of allSubs) {
          if (!userSubsMap[sub.user_id]) userSubsMap[sub.user_id] = []
          userSubsMap[sub.user_id].push(sub)
        }

        for (const [userId, subs] of Object.entries(userSubsMap)) {
          // Check user notification settings
          const { data: settings } = await supabaseAdmin
            .from('notification_settings')
            .select('attendance_reminders')
            .eq('user_id', userId)
            .maybeSingle()

          if (settings && settings.attendance_reminders === false) {
            continue
          }

          // Check if attendance already marked today
          const { data: att } = await supabaseAdmin
            .from('attendance')
            .select('id')
            .eq('user_id', userId)
            .eq('attendance_date', todayStr)
            .maybeSingle()

          if (att) {
            continue // Already submitted, stop reminders
          }

          // Check if notification already logged for this 10-minute slot
          const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('notification_key', notificationKey)
            .maybeSingle()

          if (!existing) {
            await supabaseAdmin.from('notifications').insert({
              user_id: userId,
              type: 'attendance',
              title,
              message,
              scheduled_at: now.toISOString(),
              notification_key: notificationKey,
              read: false,
            })

            const payload = JSON.stringify({
              title,
              body: message,
              url: '/',
              tag: notificationKey,
            })

            for (const sub of subs) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                )
                sentCount++
              } catch (e: any) {
                if (e?.statusCode === 410 || e?.statusCode === 404) {
                  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                }
              }
            }
          }
        }
      }
    }

    // 3. Attendance Expiration & Auto-Absent at 10:00 PM IST (hours === 22)
    if (hours === 22 && minutes < 30) {
      const absentKey = `attendance-absent-${todayStr}`
      const { data: allSubs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth')

      if (allSubs && allSubs.length > 0) {
        const userSubsMap: Record<string, typeof allSubs> = {}
        for (const sub of allSubs) {
          if (!userSubsMap[sub.user_id]) userSubsMap[sub.user_id] = []
          userSubsMap[sub.user_id].push(sub)
        }

        for (const [userId, subs] of Object.entries(userSubsMap)) {
          const { data: att } = await supabaseAdmin
            .from('attendance')
            .select('id')
            .eq('user_id', userId)
            .eq('attendance_date', todayStr)
            .maybeSingle()

          if (!att) {
            const { data: existing } = await supabaseAdmin
              .from('notifications')
              .select('id')
              .eq('user_id', userId)
              .eq('notification_key', absentKey)
              .maybeSingle()

            if (!existing) {
              await supabaseAdmin.from('attendance').insert({
                user_id: userId,
                attendance_date: todayStr,
                status: 'absent',
                reason: 'Attendance window expired at 10:00 PM',
              })

              const absentTitle = '❌ Marked Absent'
              const absentMsg = 'You were automatically marked ABSENT because attendance was not submitted before 10:00 PM.'

              await supabaseAdmin.from('notifications').insert({
                user_id: userId,
                type: 'attendance',
                title: absentTitle,
                message: absentMsg,
                scheduled_at: now.toISOString(),
                notification_key: absentKey,
                read: false,
              })

              const payload = JSON.stringify({
                title: absentTitle,
                body: absentMsg,
                url: '/',
                tag: absentKey,
              })

              for (const sub of subs) {
                try {
                  await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                  )
                  sentCount++
                } catch (e: any) {
                  if (e?.statusCode === 410 || e?.statusCode === 404) {
                    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                  }
                }
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount, timestamp: now.toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

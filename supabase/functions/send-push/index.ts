// @ts-nocheck
// Supabase Edge Function: send-push
// Sends Web Push Notifications to registered device/phone endpoints via VAPID keys

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      throw new Error('VAPID keys not configured in Supabase Edge Function secrets.')
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    // Initialize Supabase Admin Client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const bodyData = await req.json().catch(() => ({}))
    let targetUserId = bodyData.user_id

    // If user_id is not directly in body, extract it from Authorization JWT
    if (!targetUserId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '').trim()
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
        if (!userError && user) {
          targetUserId = user.id
        }
      }
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing user_id for push notification' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const {
      title = 'Hostel Life Tracker 🔔',
      body = 'You have a reminder',
      url = '/reminders',
      tag = `hostel-reminder-${Date.now()}`,
      category,
      reminderId,
    } = bodyData

    // Check user notification settings if category is specified
    if (category) {
      const { data: settings } = await supabaseAdmin
        .from('notification_settings')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (settings && settings[`${category}_reminders`] === false) {
        return new Response(JSON.stringify({ message: 'User muted this notification category' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    // Get active push subscriptions for target user
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId)

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No active push subscriptions found for this user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Prepare push payload
    const payload = JSON.stringify({
      title,
      body,
      url,
      tag,
      reminderId,
      timestamp: Date.now(),
    })

    // Send push to each subscribed device/phone
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          )
          return { endpoint: sub.endpoint, status: 'sent' }
        } catch (err: any) {
          // If subscription has expired (HTTP 404 or 410 Gone), automatically prune it from database
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          throw err
        }
      })
    )

    const successfulSends = results.filter((r) => r.status === 'fulfilled').length

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successfulSends,
        totalDevices: subscriptions.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

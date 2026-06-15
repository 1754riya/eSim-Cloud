import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  presenceConnected,
  presenceDisconnected,
  presenceUserJoined,
  presenceUserLeft,
  presenceListUpdated
} from '../redux/actions/collaborationActions'

const PING_INTERVAL_MS = 25000 // keepalive: server drops idle WS after 30 s on some proxies
const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS = 30000

function buildWsUrl (saveId, token) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const base = `${proto}://${window.location.host}/ws/presence/${saveId}/`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

/**
 * Manages the WebSocket lifecycle for presence in a project room.
 * Call inside the schematic editor page when a save_id is known.
 * Reconnects automatically with exponential back-off.
 * Safe to call with a null/undefined saveId — does nothing until one is provided.
 */
export function usePresence (saveId) {
  const dispatch = useDispatch()
  const token = useSelector(state => state.authReducer.token)

  const wsRef = useRef(null)
  const pingRef = useRef(null)
  const reconnectRef = useRef(null)
  const delayRef = useRef(RECONNECT_BASE_MS)
  const activeRef = useRef(false) // becomes false on cleanup → suppresses reconnect

  useEffect(() => {
    if (!saveId) return

    activeRef.current = true

    function teardown () {
      clearInterval(pingRef.current)
      clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        // Null handlers before close to prevent stale callbacks firing
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        if (wsRef.current.readyState < WebSocket.CLOSING) {
          wsRef.current.close()
        }
        wsRef.current = null
      }
    }

    function connect () {
      if (!activeRef.current) return
      teardown()

      const socket = new WebSocket(buildWsUrl(saveId, token))
      wsRef.current = socket

      socket.onopen = () => {
        if (!activeRef.current) { socket.close(); return }
        dispatch(presenceConnected())
        delayRef.current = RECONNECT_BASE_MS
        pingRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }))
          }
        }, PING_INTERVAL_MS)
      }

      socket.onmessage = (evt) => {
        let msg
        try { msg = JSON.parse(evt.data) } catch (_) { return }
        switch (msg.type) {
          case 'USER_JOINED':
            dispatch(presenceUserJoined(msg.user, msg.users)); break
          case 'USER_LEFT':
            dispatch(presenceUserLeft(msg.user, msg.users)); break
          case 'PRESENCE_LIST':
            dispatch(presenceListUpdated(msg.users)); break
          default: break // PONG — no action needed
        }
      }

      socket.onerror = () => {
        // onclose always fires after onerror; let onclose handle reconnect
      }

      socket.onclose = () => {
        clearInterval(pingRef.current)
        dispatch(presenceDisconnected())
        if (!activeRef.current) return
        reconnectRef.current = setTimeout(() => {
          delayRef.current = Math.min(delayRef.current * 2, RECONNECT_MAX_MS)
          connect()
        }, delayRef.current)
      }
    }

    connect()

    return () => {
      activeRef.current = false
      teardown()
      dispatch(presenceDisconnected())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId, token])
}

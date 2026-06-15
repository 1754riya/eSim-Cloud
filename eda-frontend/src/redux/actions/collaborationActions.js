import * as actions from './actions'

export const presenceConnected = () => ({
  type: actions.PRESENCE_CONNECTED
})

export const presenceDisconnected = () => ({
  type: actions.PRESENCE_DISCONNECTED
})

export const presenceListUpdated = (users) => ({
  type: actions.PRESENCE_LIST_UPDATED,
  payload: { users }
})

export const presenceUserJoined = (user, users) => ({
  type: actions.PRESENCE_USER_JOINED,
  payload: { user, users }
})

export const presenceUserLeft = (user, users) => ({
  type: actions.PRESENCE_USER_LEFT,
  payload: { user, users }
})

export const presenceClearNotification = () => ({
  type: actions.PRESENCE_CLEAR_NOTIFICATION
})

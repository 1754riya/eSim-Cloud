import * as actions from '../actions/actions'

const initialState = {
  connected: false,
  users: [],
  notification: null // { type: 'joined' | 'left', username: string }
}

export default function presenceReducer (state = initialState, action) {
  switch (action.type) {
    case actions.PRESENCE_CONNECTED:
      return { ...state, connected: true }

    case actions.PRESENCE_DISCONNECTED:
      return { ...state, connected: false, users: [] }

    case actions.PRESENCE_LIST_UPDATED:
      return { ...state, users: action.payload.users }

    case actions.PRESENCE_USER_JOINED:
      return {
        ...state,
        users: action.payload.users,
        notification: { type: 'joined', username: action.payload.user.username }
      }

    case actions.PRESENCE_USER_LEFT:
      return {
        ...state,
        users: action.payload.users,
        notification: { type: 'left', username: action.payload.user.username }
      }

    case actions.PRESENCE_CLEAR_NOTIFICATION:
      return { ...state, notification: null }

    default:
      return state
  }
}

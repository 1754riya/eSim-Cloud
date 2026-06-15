import React, { useEffect } from 'react'
import {
  Chip,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Tooltip,
  Typography
} from '@material-ui/core'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import PersonIcon from '@material-ui/icons/Person'
import CloseIcon from '@material-ui/icons/Close'
import { makeStyles } from '@material-ui/core/styles'
import { useSelector, useDispatch } from 'react-redux'
import { presenceClearNotification } from '../../redux/actions/collaborationActions'
import { useIsEditor } from '../../utils/useIsEditor'

const NOTIFICATION_DURATION_MS = 4000

const useStyles = makeStyles((theme) => ({
  root: {
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(1)
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1),
    cursor: 'pointer',
    userSelect: 'none',
    '&:hover': {
      backgroundColor: theme.palette.action.hover
    }
  },
  dot: {
    fontSize: 10,
    marginRight: theme.spacing(0.75),
    flexShrink: 0
  },
  dotOnline: { color: '#52c41a' },
  dotOffline: { color: '#bfbfbf' },
  countText: {
    fontWeight: 600,
    fontSize: '0.82rem',
    flexGrow: 1
  },
  userItem: {
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: theme.spacing(3)
  },
  userIcon: {
    minWidth: 28,
    color: theme.palette.text.secondary
  },
  userName: {
    fontSize: '0.80rem'
  },
  guestName: {
    fontSize: '0.80rem',
    color: theme.palette.text.disabled,
    fontStyle: 'italic'
  },
  emptyText: {
    padding: theme.spacing(0.5, 3),
    fontSize: '0.78rem',
    color: theme.palette.text.disabled,
    fontStyle: 'italic'
  },
  roleChip: {
    height: 18,
    fontSize: '0.68rem',
    marginLeft: theme.spacing(0.75)
  }
}))

export default function PresencePanel () {
  const classes = useStyles()
  const dispatch = useDispatch()
  const { connected, users, notification } = useSelector(state => state.presenceReducer)
  const saveId = useSelector(state => state.saveSchematicReducer.details.save_id)
  const isEditor = useIsEditor()

  const [expanded, setExpanded] = React.useState(true)

  // Auto-dismiss notifications
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      dispatch(presenceClearNotification())
    }, NOTIFICATION_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notification, dispatch])

  // Don't render until a schematic is saved/loaded (no room to join)
  if (!saveId) return null

  const onlineCount = users.length
  const statusLabel = connected
    ? `${onlineCount} Online`
    : 'Connecting...'

  const notificationMessage = notification
    ? notification.type === 'joined'
      ? `${notification.username} joined`
      : `${notification.username} left`
    : ''

  return (
    <div className={classes.root}>
      <div
        className={classes.header}
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(prev => !prev)}
      >
        <Tooltip title={connected ? 'Connected' : 'Disconnected'}>
          <FiberManualRecordIcon
            className={`${classes.dot} ${connected ? classes.dotOnline : classes.dotOffline}`}
          />
        </Tooltip>
        <Typography className={classes.countText}>{statusLabel}</Typography>
        {saveId && (
          <Chip
            label={isEditor ? 'Editing' : 'Viewing'}
            size="small"
            color={isEditor ? 'primary' : 'default'}
            className={classes.roleChip}
          />
        )}
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </div>

      <Collapse in={expanded}>
        <List disablePadding dense>
          {users.length === 0 ? (
            <Typography className={classes.emptyText}>No viewers</Typography>
          ) : (
            users.map((u, idx) => (
              <ListItem key={u.username + idx} className={classes.userItem} dense>
                <ListItemIcon className={classes.userIcon}>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={u.username}
                  primaryTypographyProps={{
                    className: u.is_anonymous ? classes.guestName : classes.userName
                  }}
                />
              </ListItem>
            ))
          )}
        </List>
      </Collapse>

      <Divider />

      {/* Join / leave toast */}
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        open={!!notification}
        message={notificationMessage}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => dispatch(presenceClearNotification())}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </div>
  )
}

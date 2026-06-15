import { useSelector } from 'react-redux'

/**
 * Returns true when the authenticated user is the owner of the currently
 * loaded schematic — i.e. they have editor privileges in a collaboration room.
 *
 * The API returns `owner` as a username string (views.py replaces the integer
 * PK with owner_name.username before responding), so we compare by username.
 *
 * Returns false for:
 *   - anonymous users
 *   - authenticated users who are not the owner
 *   - any session where no schematic is loaded (saveId absent)
 */
export function useIsEditor () {
  const saveId = useSelector(state => state.saveSchematicReducer.details.save_id)
  const owner = useSelector(state => state.saveSchematicReducer.details.owner)
  const auth = useSelector(state => state.authReducer)
  return !!(
    auth.isAuthenticated &&
    auth.user &&
    saveId &&
    owner === auth.user.username
  )
}

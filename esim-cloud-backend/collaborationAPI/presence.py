import json
import logging

import redis as sync_redis
from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        url = getattr(settings, 'REDIS_URL', 'redis://redis:6379')
        _client = sync_redis.from_url(url, decode_responses=True)
    return _client


def _channel_key(save_id):
    return f'presence:channels:{save_id}'


def _user_key(save_id):
    return f'presence:users:{save_id}'


_TTL = 86400  # 24 h — refreshed on every join


class PresenceStore:
    """
    Redis-backed presence store.

    Two hashes per room:
      presence:channels:<save_id>  →  { channel_name: user_key }
      presence:users:<save_id>     →  { user_key: user_info_json }

    A user appears in the presence list as long as they have ≥ 1 active
    channel (i.e. ≥ 1 open browser tab).  Closing a tab removes its channel
    entry; the user entry is removed only when no channel maps to them.
    """

    @classmethod
    def add(cls, save_id, channel_name, user_key, user_info):
        """Register channel_name for user_key in save_id's room."""
        try:
            r = _get_client()
            ck = _channel_key(save_id)
            uk = _user_key(save_id)
            pipe = r.pipeline()
            pipe.hset(ck, channel_name, user_key)
            pipe.hset(uk, user_key, json.dumps(user_info))
            pipe.expire(ck, _TTL)
            pipe.expire(uk, _TTL)
            pipe.execute()
        except Exception:
            logger.exception('PresenceStore.add failed')

    @classmethod
    def remove(cls, save_id, channel_name, user_key):
        """Remove channel_name from the room.

        Returns True when the user has no remaining channels (last tab closed)
        so the caller knows to broadcast USER_LEFT.
        Returns False when the user still has other open tabs.
        """
        try:
            r = _get_client()
            ck = _channel_key(save_id)
            uk = _user_key(save_id)
            r.hdel(ck, channel_name)
            remaining = r.hvals(ck)
            if user_key not in remaining:
                r.hdel(uk, user_key)
                return True
            return False
        except Exception:
            logger.exception('PresenceStore.remove failed')
            return True

    @classmethod
    def get_users(cls, save_id):
        """Return list of user_info dicts for every user currently in the room."""
        try:
            r = _get_client()
            raw_values = r.hvals(_user_key(save_id))
            users = []
            for v in raw_values:
                try:
                    users.append(json.loads(v))
                except (json.JSONDecodeError, TypeError):
                    pass
            return users
        except Exception:
            logger.exception('PresenceStore.get_users failed')
            return []

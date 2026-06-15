import json
import logging
import urllib.parse

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .auth import get_user_from_token
from .presence import PresenceStore

logger = logging.getLogger(__name__)


class PresenceConsumer(AsyncWebsocketConsumer):
    """
    Tracks which users are currently viewing a specific project.

    URL route:  /ws/presence/<save_id>/
    Query param: token=<drf_auth_token>   (omit for anonymous)

    Channel group: presence__<save_id>
    All consumers in the group receive presence updates and forward them
    to their respective WebSocket clients.

    Protocol (server → client):
      { "type": "USER_JOINED",    "user": {...}, "users": [...] }
      { "type": "USER_LEFT",      "user": {...}, "users": [...] }
      { "type": "PRESENCE_LIST",  "users": [...] }
      { "type": "PONG" }

    Protocol (client → server):
      { "type": "PING" }
    """

    async def connect(self):
        self.save_id = self.scope['url_route']['kwargs']['save_id']
        # Channel group name — hyphens are valid per channels-redis spec
        self.room_group = f'presence__{self.save_id}'

        token = self._parse_token(
            self.scope.get('query_string', b'').decode('utf-8')
        )
        self.user = await sync_to_async(get_user_from_token)(token)

        if self.user.is_anonymous:
            # Unique key per connection so anonymous users are tracked individually
            self.user_key = f'anon__{self.channel_name}'
            self.user_info = {'username': 'Guest', 'is_anonymous': True}
        else:
            # Deduplicate across tabs: one user_key per authenticated user
            self.user_key = f'user__{self.user.pk}'
            self.user_info = {
                'username': self.user.username,
                'is_anonymous': False,
            }

        await sync_to_async(PresenceStore.add)(
            self.save_id, self.channel_name, self.user_key, self.user_info
        )

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        users = await sync_to_async(PresenceStore.get_users)(self.save_id)
        await self.channel_layer.group_send(
            self.room_group,
            {
                'type': 'presence.broadcast',
                'event': 'USER_JOINED',
                'user': self.user_info,
                'users': users,
            },
        )

    async def disconnect(self, close_code):
        user_fully_left = await sync_to_async(PresenceStore.remove)(
            self.save_id, self.channel_name, self.user_key
        )

        if user_fully_left:
            users = await sync_to_async(PresenceStore.get_users)(self.save_id)
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'presence.broadcast',
                    'event': 'USER_LEFT',
                    'user': self.user_info,
                    'users': users,
                },
            )

        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        try:
            msg = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        if msg.get('type') == 'PING':
            await self.send(json.dumps({'type': 'PONG'}))

    # ------------------------------------------------------------------ #
    # Group message handler — name maps to type 'presence.broadcast'       #
    # ------------------------------------------------------------------ #

    async def presence_broadcast(self, event):
        """Forward a presence event to this consumer's WebSocket client."""
        await self.send(
            json.dumps(
                {
                    'type': event['event'],
                    'user': event['user'],
                    'users': event['users'],
                }
            )
        )

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _parse_token(query_string):
        """Extract 'token' from a URL query string."""
        params = urllib.parse.parse_qs(query_string)
        values = params.get('token', [])
        return values[0] if values else None


class SyncConsumer(AsyncWebsocketConsumer):
    """
    Relays circuit sync events between an editor and viewers in a project room.
    Deliberately isolated from PresenceConsumer — no presence side-effects.

    URL route:  /ws/sync/<save_id>/
    Query param: token=<drf_auth_token>   (omit for anonymous)

    Channel group: sync__<save_id>

    Protocol (client → server):
      { "type": "PING" }
      { "type": "PROJECT_SNAPSHOT", "xml": "<mxGraphModel>..." }

    Protocol (server → client):
      { "type": "PONG" }
      { "type": "PROJECT_SNAPSHOT", "xml": "..." }

    The consumer that sent PROJECT_SNAPSHOT does NOT receive its own echo.
    Future incremental events (COMPONENT_ADDED, COMPONENT_MOVED, …) follow
    the same relay pattern via sync_relay without requiring consumer changes.
    """

    async def connect(self):
        self.save_id = self.scope['url_route']['kwargs']['save_id']
        self.room_group = f'sync__{self.save_id}'

        token = self._parse_token(
            self.scope.get('query_string', b'').decode('utf-8')
        )
        self.user = await sync_to_async(get_user_from_token)(token)

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        try:
            msg = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = msg.get('type')

        if msg_type == 'PING':
            await self.send(json.dumps({'type': 'PONG'}))

        elif msg_type == 'PROJECT_SNAPSHOT':
            xml = msg.get('xml', '')
            if xml:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        'type': 'sync.relay',
                        'event_type': 'PROJECT_SNAPSHOT',
                        'payload': {'xml': xml},
                        'sender_channel': self.channel_name,
                    }
                )

        # Phase 3 hook: COMPONENT_ADDED, COMPONENT_MOVED, PROPERTY_CHANGED, etc.
        # will be handled here with the same group_send / sync.relay pattern.

    async def sync_relay(self, event):
        """Forward a sync event to this consumer's client, skipping the sender."""
        if event.get('sender_channel') == self.channel_name:
            return
        await self.send(
            json.dumps({
                'type': event['event_type'],
                **event['payload'],
            })
        )

    @staticmethod
    def _parse_token(query_string):
        params = urllib.parse.parse_qs(query_string)
        values = params.get('token', [])
        return values[0] if values else None

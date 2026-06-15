from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r'^ws/presence/(?P<save_id>[0-9a-f-]+)/$',
        consumers.PresenceConsumer.as_asgi(),
    ),
    re_path(
        r'^ws/sync/(?P<save_id>[0-9a-f-]+)/$',
        consumers.SyncConsumer.as_asgi(),
    ),
]

from django.contrib.auth.models import AnonymousUser


def get_user_from_token(token_key):
    """Resolve a DRF auth token string to a User instance.

    Returns AnonymousUser when the token is absent or invalid so the
    consumer can handle authenticated and anonymous viewers uniformly.
    """
    if not token_key:
        return AnonymousUser()
    try:
        from rest_framework.authtoken.models import Token
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Exception:
        return AnonymousUser()

"""
URL Patterns for Ephemeral Access Control and Telemetry.
"""

from django.urls import path
from access_control.views import (
    CreateShareLinkView,
    ValidateTokenView,
    ViewOnlyStreamView,
    DownloadStreamView,
    RevokeAccessView,
    SenderSharesListView,
    ReceiverSharesListView,
    AccessHistoryView,
    SecurityStatsView,
    TrackExternalShareView,
    PolicyAccessHistoryView
)

app_name = 'access_control'

urlpatterns = [
    path('share/', CreateShareLinkView.as_view(), name='create-share'),
    path('shares/create/', CreateShareLinkView.as_view(), name='create-share-alt'),
    path('shares/sent/', SenderSharesListView.as_view(), name='sender-shares'),
    path('shares/received/', ReceiverSharesListView.as_view(), name='receiver-shares'),
    path('revoke/<uuid:pk>/', RevokeAccessView.as_view(), name='revoke-access'),
    path('shares/<uuid:pk>/revoke/', RevokeAccessView.as_view(), name='revoke-access-alt'),
    path('shares/<uuid:pk>/track-share/', TrackExternalShareView.as_view(), name='track-external-share'),
    path('shares/<uuid:pk>/history/', PolicyAccessHistoryView.as_view(), name='policy-history'),
    path('token/<str:token>/validate/', ValidateTokenView.as_view(), name='validate-token'),
    path('token/<str:token>/view/', ViewOnlyStreamView.as_view(), name='view-stream'),
    path('token/<str:token>/download/', DownloadStreamView.as_view(), name='download-stream'),
    path('history/', AccessHistoryView.as_view(), name='access-history'),
    path('stats/', SecurityStatsView.as_view(), name='security-stats'),
]

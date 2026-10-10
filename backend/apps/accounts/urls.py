"""
URL patterns for User Authentication and Account management.
"""

from django.urls import path
from accounts.views import (
    RegisterView,
    LoginView,
    LogoutView,
    UserProfileView,
    ReceiversListView
)

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('receivers/', ReceiversListView.as_view(), name='receivers'),
]

"""
Root URL configuration for Secure File Exchange Portal.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls', namespace='accounts')),
    path('api/files/', include('files.urls', namespace='files')),
    path('api/access/', include('access_control.urls', namespace='access_control')),
]

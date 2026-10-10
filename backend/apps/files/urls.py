"""
URL patterns for File Upload and Management.
"""

from django.urls import path
from files.views import FileUploadView, FileListView, FileDetailView

app_name = 'files'

urlpatterns = [
    path('upload/', FileUploadView.as_view(), name='file-upload'),
    path('', FileListView.as_view(), name='file-list'),
    path('<uuid:pk>/', FileDetailView.as_view(), name='file-detail'),
]

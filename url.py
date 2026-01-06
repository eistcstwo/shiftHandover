
from django.urls import path
from projectRoster.views import FileUploadView, SearchView, UpdateAnnotationView

urlpatterns = [
    path('upload/', FileUploadView.as_view(), name='file-upload'),
    path('search/', SearchView.as_view(), name='data-search'),
    path('update_annotation/', UpdateAnnotationView.as_view(), name='update_annotation'),
]

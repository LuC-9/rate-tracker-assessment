from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('rates/', include('rates.urls')),
    path('health/', include('rates.health_urls')),
]

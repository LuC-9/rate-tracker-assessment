from django.contrib import admin

from rates.models import Rate, RawResponse

admin.site.register(RawResponse)
admin.site.register(Rate)

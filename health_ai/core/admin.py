from django.contrib import admin
from .models import User, FAQ, ChatHistory, UploadedReport

admin.site.register(User)
admin.site.register(FAQ)
admin.site.register(ChatHistory)
admin.site.register(UploadedReport)

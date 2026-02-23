from rest_framework import serializers
from .models import User, FAQ, ChatHistory, UploadedReport


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = "__all__"


class ChatHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatHistory
        fields = "__all__"


class UploadedReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedReport
        fields = "__all__"

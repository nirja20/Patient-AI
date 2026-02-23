from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings


class User(AbstractUser):

    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('patient', 'Patient'),
    )

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    language = models.CharField(max_length=10, default='en')
    dob = models.DateField(null=True, blank=True)
    GENDER_CHOICES = (
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
        ('prefer_not_to_say', 'Prefer not to say'),
    )
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True, default='')

    def __str__(self):
        return self.username


class FAQ(models.Model):

    keyword = models.CharField(max_length=255)
    symptoms = models.TextField()
    advice = models.TextField()
    when_to_visit = models.TextField()
    embedding = models.JSONField(null=True, blank=True)

    def __str__(self):
        return self.keyword

    def save(self, *args, **kwargs):
        from .embeddings import generate_embedding  # import inside method (IMPORTANT)

        if not self.embedding:
            self.embedding = generate_embedding(self.symptoms)

        super().save(*args, **kwargs)

class Conversation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.created_at}"



class ChatHistory(models.Model):

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
        null=True,
        blank=True
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    response = models.TextField()
    language = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.created_at}"


class UploadedReport(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to='reports/')
    extracted_text = models.TextField(null=True, blank=True)
    processed_output = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.created_at}"

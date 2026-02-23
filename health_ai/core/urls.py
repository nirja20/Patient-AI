from django.urls import path
from .views import (
    chat_view,
    get_conversation_history,
    conversation_list,
    upload_report_view,
    delete_conversation,
    edit_chat_message,
    signup_view,
    login_view,
    google_login_view,
    current_user_view,
)

urlpatterns = [
    path("auth/signup/", signup_view),
    path("auth/login/", login_view),
    path("auth/google-login/", google_login_view),
    path("auth/me/", current_user_view),
    path("chat/", chat_view),
    path("chat/<int:chat_id>/edit/", edit_chat_message),
    path("conversation/<int:conversation_id>/", get_conversation_history),
    path("conversation/<int:conversation_id>/delete/", delete_conversation),
    path('conversations/', conversation_list),
    path("upload-report/", upload_report_view),

]

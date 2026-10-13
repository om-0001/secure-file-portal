"""
Authentication and User Account Views.
Implements token-based and session-ready authentication with strict validation.
"""

from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import login, logout

from accounts.models import User, UserRole
from accounts.serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer
)


class RegisterView(generics.CreateAPIView):
    """
    Register a new user account.
    Returns the user details along with an authentication token.
    """
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate authentication token
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "message": "User registered successfully.",
            "token": token.key,
            "user": UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Authenticate user and issue auth token.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Ensure session and token are synchronized
        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "message": "Login successful.",
            "token": token.key,
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Invalidate the user's authentication token and terminate session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            # Delete auth token from database to prevent token reuse
            request.user.auth_token.delete()
        except (AttributeError, Token.DoesNotExist):
            pass

        logout(request)
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Fetch or update current authenticated user profile.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ReceiversListView(generics.ListAPIView):
    """
    List potential file receivers.
    All users can send and receive files. Excludes the current authenticated user from their own receiver list.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(
            is_active=True
        ).exclude(id=self.request.user.id).order_by('username')


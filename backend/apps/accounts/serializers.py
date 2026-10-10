"""
Serializers for User Authentication, Registration, and Profiles.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from accounts.models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """
    Public and self-view user information serializer.
    """
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Handles secure user registration.
    Validates password strength, email uniqueness, and securely hashes password.
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'validators': []},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords do not match."})

        email = attrs.get('email', '').strip().lower()
        existing = User.objects.filter(email__iexact=email).first()
        if existing and existing.has_usable_password():
            raise serializers.ValidationError({"email": "A user with this email address already exists."})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        email = validated_data['email'].strip().lower()
        existing_user = User.objects.filter(email__iexact=email).first()

        if existing_user and not existing_user.has_usable_password():
            existing_user.username = validated_data['username']
            existing_user.set_password(validated_data['password'])
            existing_user.first_name = validated_data.get('first_name', '')
            existing_user.last_name = validated_data.get('last_name', '')
            existing_user.role = UserRole.BOTH
            existing_user.is_active = True
            existing_user.save()
            return existing_user

        user = User.objects.create_user(
            username=validated_data['username'],
            email=email,
            password=validated_data['password'],
            role=UserRole.BOTH,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user


class LoginSerializer(serializers.Serializer):
    """
    Validates user login credentials (username/email + password).
    """
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        username_or_email = attrs.get('username')
        password = attrs.get('password')

        user = None
        # Allow logging in with either username or email
        if '@' in username_or_email:
            try:
                user_obj = User.objects.get(email__iexact=username_or_email)
                username = user_obj.username
            except User.DoesNotExist:
                username = username_or_email
        else:
            username = username_or_email

        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError("Invalid credentials. Please verify username/email and password.")

        if not user.is_active:
            raise serializers.ValidationError("This user account has been disabled.")

        attrs['user'] = user
        return attrs

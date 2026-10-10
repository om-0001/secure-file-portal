"""
Automated Test Suite for User Authentication and Role Management (Phase 2 & 3).
"""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from accounts.models import User, UserRole


class AuthenticationTests(APITestCase):
    def setUp(self):
        # Create a pre-existing receiver user for receiver list testing
        self.receiver_user = User.objects.create_user(
            username='receiver_bob',
            email='bob@example.com',
            password='SecureBobPassword123!',
            role=UserRole.RECEIVER
        )
        self.register_url = reverse('accounts:register')
        self.login_url = reverse('accounts:login')
        self.logout_url = reverse('accounts:logout')
        self.profile_url = reverse('accounts:profile')
        self.receivers_url = reverse('accounts:receivers')

    def test_01_valid_registration(self):
        """TC01: Valid user registration should return 201 and auth token."""
        payload = {
            "username": "sender_alice",
            "email": "alice@example.com",
            "password": "StrongAlicePassword123!",
            "password_confirm": "StrongAlicePassword123!",
            "role": "SENDER"
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], "sender_alice")
        self.assertEqual(response.data["user"]["role"], "BOTH")

        # Verify password is NOT stored in plaintext
        user = User.objects.get(username="sender_alice")
        self.assertNotEqual(user.password, "StrongAlicePassword123!")
        self.assertTrue(user.check_password("StrongAlicePassword123!"))

    def test_02_registration_password_mismatch(self):
        """TC02: Registration with mismatched passwords should fail."""
        payload = {
            "username": "charlie",
            "email": "charlie@example.com",
            "password": "Password123!",
            "password_confirm": "DifferentPassword123!",
            "role": "BOTH"
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_03_registration_duplicate_email(self):
        """Registration with an existing email should fail."""
        payload = {
            "username": "bob_clone",
            "email": "bob@example.com",  # already exists in setUp
            "password": "AnotherPassword123!",
            "password_confirm": "AnotherPassword123!",
            "role": "RECEIVER"
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_04_valid_login_with_username(self):
        """TC03: Valid login with username should return auth token."""
        payload = {
            "username": "receiver_bob",
            "password": "SecureBobPassword123!"
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "bob@example.com")

    def test_05_valid_login_with_email(self):
        """Login using email address instead of username should succeed."""
        payload = {
            "username": "bob@example.com",
            "password": "SecureBobPassword123!"
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)

    def test_06_invalid_login_credentials(self):
        """TC04: Invalid password should return 400 Bad Request."""
        payload = {
            "username": "receiver_bob",
            "password": "WrongPassword999!"
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_07_profile_requires_authentication(self):
        """Unauthenticated profile access should be rejected with 401."""
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_08_profile_with_token_authentication(self):
        """Authenticated profile access should return current user info."""
        token, _ = Token.objects.get_or_create(user=self.receiver_user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "receiver_bob")

    def test_09_logout_invalidates_token(self):
        """Logout should delete user's auth token."""
        token, _ = Token.objects.get_or_create(user=self.receiver_user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        response = self.client.post(self.logout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Token should now be deleted from database
        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_10_receiver_list_filtering(self):
        """Receiver list should only return receivers and exclude the caller."""
        # Create sender alice
        sender_alice = User.objects.create_user(
            username='alice_sender',
            email='alice@example.com',
            password='AlicePassword123!',
            role=UserRole.SENDER
        )
        token, _ = Token.objects.get_or_create(user=sender_alice)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        response = self.client.get(self.receivers_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        usernames = [u['username'] for u in response.data]
        self.assertIn('receiver_bob', usernames)
        self.assertNotIn('alice_sender', usernames)

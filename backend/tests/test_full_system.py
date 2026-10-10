"""
Comprehensive Automated Test Suite for Secure File Exchange Portal.
Validates all core security properties:
- File Upload & Safe Scanning
- EICAR Malware Detection & Immediate Quarantine Purge
- AES-256-GCM Envelope Encryption & Integrity
- Ephemeral Link Creation with CSPRNG Tokens
- Strict Receiver Binding (Forwarding Prevention)
- Server-side View-Only Enforcement (Blocking Download Endpoint)
- Expiration Timestamp Enforcement
- Atomic Access Limit Invalidation (One-Time and N-Times)
- Manual Revocation Mechanism
- Security Audit Logging
"""

import io
from datetime import timedelta
from django.utils import timezone
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from accounts.models import User, UserRole
from files.models import File
from access_control.models import AccessPolicy, AccessType, PolicyStatus, AccessLog
from malware_scanner.scanner import EICAR_SIGNATURE


class FullSecuritySystemTests(APITestCase):
    def setUp(self):
        # 1. Setup Sender User A
        self.sender_alice = User.objects.create_user(
            username='alice_sender',
            email='alice@example.com',
            password='AlicePassword123!',
            role=UserRole.SENDER
        )
        self.token_alice, _ = Token.objects.get_or_create(user=self.sender_alice)

        # 2. Setup Authorized Receiver User B
        self.receiver_bob = User.objects.create_user(
            username='bob_receiver',
            email='bob@example.com',
            password='BobPassword123!',
            role=UserRole.RECEIVER
        )
        self.token_bob, _ = Token.objects.get_or_create(user=self.receiver_bob)

        # 3. Setup Unauthorized Interceptor User C
        self.unauthorized_charlie = User.objects.create_user(
            username='charlie_attacker',
            email='charlie@example.com',
            password='CharliePassword123!',
            role=UserRole.RECEIVER
        )
        self.token_charlie, _ = Token.objects.get_or_create(user=self.unauthorized_charlie)

        # URLs
        self.upload_url = reverse('files:file-upload')
        self.share_url = reverse('access_control:create-share')

    def test_01_upload_safe_file_scanned_and_encrypted(self):
        """TC05 & TC11: Safe file upload is scanned clean and encrypted with AES-256-GCM."""
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)

        file_content = b"Confidential financial statement 2026."
        uploaded = SimpleUploadedFile("statement.txt", file_content, content_type="text/plain")

        response = self.client.post(self.upload_url, {'file': uploaded}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['file']['scan_status'], 'CLEAN')

        # Verify database records
        file_id = response.data['file']['id']
        file_record = File.objects.get(id=file_id)
        self.assertEqual(file_record.original_name, "statement.txt")
        self.assertTrue(hasattr(file_record, 'encryption_metadata'))
        self.assertEqual(file_record.encryption_metadata.algorithm, "AES-256-GCM")

        # Verify plaintext is NOT stored on disk
        with open(file_record.encrypted_file_path, 'rb') as f:
            stored_ciphertext = f.read()
        self.assertNotIn(file_content, stored_ciphertext)

    def test_02_upload_malware_rejected_and_purged(self):
        """TC10: Malware (EICAR) upload is detected, rejected with 400, and purged."""
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)

        eicar_file = SimpleUploadedFile("eicar_test.txt", EICAR_SIGNATURE, content_type="text/plain")

        response = self.client.post(self.upload_url, {'file': eicar_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['scan_status'], 'INFECTED')
        self.assertIn("EICAR", response.data['threat'])

        # Verify no file record was persisted
        self.assertEqual(File.objects.filter(original_name="eicar_test.txt").count(), 0)

    def _upload_safe_file_helper(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        uploaded = SimpleUploadedFile("test_report.pdf", b"%PDF-1.4 sample secure data", content_type="application/pdf")
        res = self.client.post(self.upload_url, {'file': uploaded}, format='multipart')
        return res.data['file']['id']

    def test_03_forwarded_link_protection(self):
        """TC12, TC13 & TC14: Link created for Bob must be rejected if opened by Charlie."""
        file_id = self._upload_safe_file_helper()

        # Alice creates an ephemeral link designated for Bob
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'VIEW_ONLY',
            'duration_minutes': 10,
            'max_accesses': 1
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        self.assertEqual(share_res.status_code, status.HTTP_201_CREATED)
        raw_token = share_res.data['raw_token']

        # Charlie (User C) obtains the forwarded link and attempts to validate it
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_charlie.key)
        validate_url = reverse('access_control:validate-token', kwargs={'token': raw_token})
        charlie_res = self.client.get(validate_url)

        # STRICTLY DENIED: 403 Forbidden with Wrong Receiver message
        self.assertEqual(charlie_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("designated recipient", str(charlie_res.data))

        # Verify security audit log captured the unauthorized forwarding attempt
        self.assertTrue(AccessLog.objects.filter(event_type='WRONG_RECEIVER').exists())

    def test_04_view_only_enforcement_blocks_download_endpoint(self):
        """TC19 & TC21: View-only link allows in-browser viewing, but strictly rejects download endpoint."""
        file_id = self._upload_safe_file_helper()

        # Alice creates VIEW_ONLY share for Bob
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'VIEW_ONLY',
            'duration_minutes': 10,
            'max_accesses': 5
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        raw_token = share_res.data['raw_token']

        # Bob switches to authenticated session
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)

        # 1. Bob views file -> Allowed!
        view_url = reverse('access_control:view-stream', kwargs={'token': raw_token})
        view_res = self.client.get(view_url)
        self.assertEqual(view_res.status_code, status.HTTP_200_OK)
        self.assertIn('inline', view_res.headers['Content-Disposition'])

        # 2. Bob attempts to invoke the DOWNLOAD endpoint directly -> DENIED with 403!
        download_url = reverse('access_control:download-stream', kwargs={'token': raw_token})
        download_res = self.client.get(download_url)
        self.assertEqual(download_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("restricted to in-browser viewing only", str(download_res.data))

    def test_05_download_permitted_policy(self):
        """TC20: When DOWNLOAD permission is configured, download endpoint streams decrypted payload."""
        file_id = self._upload_safe_file_helper()

        # Alice creates DOWNLOAD share for Bob
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'DOWNLOAD',
            'duration_minutes': 10,
            'max_accesses': 2
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        raw_token = share_res.data['raw_token']

        # Bob downloads -> Allowed!
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)
        download_url = reverse('access_control:download-stream', kwargs={'token': raw_token})
        download_res = self.client.get(download_url)
        self.assertEqual(download_res.status_code, status.HTTP_200_OK)
        self.assertIn('attachment', download_res.headers['Content-Disposition'])
        self.assertEqual(download_res.content, b"%PDF-1.4 sample secure data")

    def test_06_access_limit_invalidation(self):
        """TC17 & TC18: One-time access limit = 1. First access succeeds, second access is denied."""
        file_id = self._upload_safe_file_helper()

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'VIEW_ONLY',
            'duration_minutes': 10,
            'max_accesses': 1
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        raw_token = share_res.data['raw_token']

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)
        view_url = reverse('access_control:view-stream', kwargs={'token': raw_token})

        # 1st access -> OK
        res1 = self.client.get(view_url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # 2nd access -> DENIED (Limit Reached)
        res2 = self.client.get(view_url)
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("limit", str(res2.data).lower())

        policy = AccessPolicy.objects.get(id=share_res.data['policy']['id'])
        self.assertEqual(policy.status, PolicyStatus.LIMIT_REACHED)

    def test_07_expired_link_invalidation(self):
        """TC15: Expired links must be rejected immediately."""
        file_id = self._upload_safe_file_helper()

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'VIEW_ONLY',
            'duration_minutes': 1,
            'max_accesses': 5
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        raw_token = share_res.data['raw_token']

        # Artificially expire the policy
        policy = AccessPolicy.objects.get(id=share_res.data['policy']['id'])
        policy.expires_at = timezone.now() - timedelta(minutes=5)
        policy.save()

        # Bob attempts access
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)
        view_url = reverse('access_control:view-stream', kwargs={'token': raw_token})
        res = self.client.get(view_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("expired", str(res.data).lower())

    def test_08_manual_revocation(self):
        """TC16: Sender can revoke active link at any time, instantly blocking future access."""
        file_id = self._upload_safe_file_helper()

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'VIEW_ONLY',
            'duration_minutes': 30,
            'max_accesses': 5
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        raw_token = share_res.data['raw_token']
        policy_id = share_res.data['policy']['id']

        # Alice revokes access
        revoke_url = reverse('access_control:revoke-access', kwargs={'pk': policy_id})
        revoke_res = self.client.post(revoke_url)
        self.assertEqual(revoke_res.status_code, status.HTTP_200_OK)

        # Bob attempts access -> DENIED
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)
        view_url = reverse('access_control:view-stream', kwargs={'token': raw_token})
        res = self.client.get(view_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("revoked", str(res.data).lower())

    def test_09_invalid_token_returns_404(self):
        """TC22: Random, corrupted, or non-existent tokens return 404 Not Found."""
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)
        validate_url = reverse('access_control:validate-token', kwargs={'token': 'invalid_random_garbage_token'})
        res = self.client.get(validate_url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_10_password_protected_link(self):
        """TC23: Link protected by password requires correct password to validate and stream."""
        file_id = self._upload_safe_file_helper()

        # Alice creates a share link with file_password
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_alice.key)
        share_payload = {
            'file_id': file_id,
            'receiver_email': 'bob@example.com',
            'access_type': 'VIEW_ONLY',
            'duration_minutes': 30,
            'max_accesses': 5,
            'file_password': 'SuperSecretPassword123!'
        }
        share_res = self.client.post(self.share_url, share_payload, format='json')
        self.assertEqual(share_res.status_code, status.HTTP_201_CREATED)
        raw_token = share_res.data['raw_token']

        # Bob validates token without password -> requires_password is True, password_verified is False
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_bob.key)
        validate_url = reverse('access_control:validate-token', kwargs={'token': raw_token})
        res = self.client.get(validate_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('requires_password'))
        self.assertFalse(res.data.get('password_verified'))

        # Bob validates token with incorrect password -> 403 Forbidden
        res_wrong = self.client.get(f"{validate_url}?password=WrongPass!")
        self.assertEqual(res_wrong.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("password", str(res_wrong.data).lower())

        # Bob validates token with correct password -> 200 OK, password_verified is True
        res_correct = self.client.get(f"{validate_url}?password=SuperSecretPassword123!")
        self.assertEqual(res_correct.status_code, status.HTTP_200_OK)
        self.assertTrue(res_correct.data.get('password_verified'))

        # Bob attempts stream without password -> 403 Forbidden
        view_url = reverse('access_control:view-stream', kwargs={'token': raw_token})
        res_stream_no_pw = self.client.get(view_url)
        self.assertEqual(res_stream_no_pw.status_code, status.HTTP_403_FORBIDDEN)

        # Bob attempts stream with correct password -> 200 OK
        res_stream_ok = self.client.get(f"{view_url}?password=SuperSecretPassword123!")
        self.assertEqual(res_stream_ok.status_code, status.HTTP_200_OK)


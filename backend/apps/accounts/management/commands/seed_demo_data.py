"""
Management command to seed initial demonstration users and sample files.
"""

from django.core.management.base import BaseCommand
from accounts.models import User, UserRole
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = "Seeds initial demo users (Alice Sender, Bob Receiver, Charlie Attacker)"

    def handle(self, *args, **options):
        users_data = [
            {
                "username": "alice_sender",
                "email": "alice@example.com",
                "password": "AlicePassword123!",
                "role": UserRole.BOTH,
                "first_name": "Alice",
                "last_name": "Sender",
            },
            {
                "username": "bob_receiver",
                "email": "bob@example.com",
                "password": "BobPassword123!",
                "role": UserRole.BOTH,
                "first_name": "Bob",
                "last_name": "Receiver",
            },
            {
                "username": "charlie_attacker",
                "email": "charlie@example.com",
                "password": "CharliePassword123!",
                "role": UserRole.BOTH,
                "first_name": "Charlie",
                "last_name": "Attacker",
            },
        ]

        for data in users_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    "email": data['email'],
                    "role": data['role'],
                    "first_name": data['first_name'],
                    "last_name": data['last_name'],
                }
            )
            if created:
                user.set_password(data['password'])
                user.save()
                Token.objects.get_or_create(user=user)
                self.stdout.write(self.style.SUCCESS(f"Created demo user: {user.username} ({user.email}) [{user.role}]"))
            else:
                self.stdout.write(self.style.WARNING(f"User {user.username} already exists."))

        self.stdout.write(self.style.SUCCESS("Demo data seeding completed!"))

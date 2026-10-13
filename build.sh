#!/usr/bin/env bash
# Production Build & Migration Script for Deployment
set -o errexit

echo "==> Upgrading pip..."
python -m pip install --upgrade pip

echo "==> Installing backend dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
elif [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
fi

echo "==> Running static collection..."
if [ -f "manage.py" ]; then
    python manage.py collectstatic --noinput
    python manage.py migrate --noinput
elif [ -f "backend/manage.py" ]; then
    python backend/manage.py collectstatic --noinput
    python backend/manage.py migrate --noinput
fi

echo "==> Build and database migrations complete."

#!/usr/bin/env bash

set -e

echo "Running Composer..."
composer install --no-dev --working-dir=/var/www/html --optimize-autoloader

echo "Preparing Laravel storage..."
mkdir -p /var/www/html/storage/framework/cache
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/logs

echo "Caching Laravel configuration..."
php artisan config:cache

echo "Caching Laravel routes..."
php artisan route:cache

echo "Running database migrations..."
php artisan migrate --force

echo "Laravel deployment preparation completed."

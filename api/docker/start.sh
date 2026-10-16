#!/bin/sh
# Runs the HTTP server, the queue worker and the scheduler in one container so they share the uploads volume.
set -e

mkdir -p storage/app/private/logos storage/framework/cache storage/framework/views storage/logs

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force

(while true; do php artisan queue:work --tries=4 --sleep=3 --max-time=3600 || true; sleep 2; done) &
(while true; do php artisan schedule:work || true; sleep 5; done) &

exec frankenphp php-server --root public --listen ":${PORT:-8080}"

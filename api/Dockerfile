FROM dunglas/frankenphp:1-php8.4-bookworm

RUN install-php-extensions pdo_mysql opcache zip pcntl

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    PHP_INI_SCAN_DIR=":/usr/local/etc/php/app.d"
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress

COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev \
 && mkdir -p storage/framework/cache storage/framework/views storage/logs bootstrap/cache \
 && mkdir -p /usr/local/etc/php/app.d \
 && printf 'opcache.enable=1\nopcache.validate_timestamps=0\nexpose_php=0\nupload_max_filesize=4M\npost_max_size=6M\n' > /usr/local/etc/php/app.d/app.ini \
 && chmod +x docker/start.sh

EXPOSE 8080
CMD ["/app/docker/start.sh"]

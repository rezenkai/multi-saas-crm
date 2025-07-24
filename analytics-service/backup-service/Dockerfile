# Backup Service Container
FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    bash \
    curl \
    docker-cli \
    postgresql-client \
    gzip \
    tar \
    findutils \
    dcron \
    tzdata

# Set timezone
ENV TZ=UTC
RUN cp /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create backup user and directories
RUN adduser -D -s /bin/bash backup
RUN mkdir -p /app/backups/postgres /app/backups/clickhouse /app/scripts /app/logs
RUN chown -R backup:backup /app

# Copy backup scripts
COPY scripts/backup-postgres.sh /app/scripts/
COPY scripts/backup-clickhouse.sh /app/scripts/
COPY backup-service/entrypoint.sh /app/entrypoint.sh

# Make scripts executable
RUN chmod +x /app/scripts/*.sh /app/entrypoint.sh

# Setup cron jobs
COPY backup-service/crontab /var/spool/cron/crontabs/root
RUN chmod 0600 /var/spool/cron/crontabs/root

# Keep root user for crond daemon
# USER backup
WORKDIR /app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep crond > /dev/null || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["crond", "-f", "-l", "2"]
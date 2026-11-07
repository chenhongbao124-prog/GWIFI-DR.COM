#!/bin/sh
# One invocation = at most one check pass. Existing scheduling is preserved.
umask 077
. /lib/functions.sh
. /lib/functions/network.sh
. /usr/lib/gwifi/common.sh

case "${1:-}" in ''|--boot|--force) ;; *) exit 2;; esac
config_load gwifi
config_get_bool RUN config enable_cron 1
[ "$RUN" = 1 ] || exit 0

# Kernel flock automatically releases the lock even after SIGKILL. The
# installer checks that a flock command is available before deploying files.
exec 9>/var/run/gwifi-check.lock || exit 1
flock -n 9
LOCK_STATUS=$?
case "$LOCK_STATUS" in
    0) ;;
    1) exit 0;;
    *) logger -t gwifi 'Unable to acquire the check lock'; exit 1;;
esac
export GWIFI_OP_HELD=1

config_get INTERVAL config interval 10
case "$INTERVAL" in 3|5|10|15|30|60) ;; *) INTERVAL=10;; esac
# Monotonic uptime avoids clock adjustments breaking the ten-minute gate.
read -r NOW rest < /proc/uptime || exit 1
NOW=${NOW%%.*}
case "$NOW" in ''|*[!0-9]*) exit 1;; esac
LAST_FILE=/var/run/gwifi_last_check
LAST=
VERSION=
if [ -r "$LAST_FILE" ]; then
    read -r VERSION LAST rest < "$LAST_FILE"
fi
if [ -z "${1:-}" ] && [ "$VERSION" = uptime-v2 ]; then
    case "$LAST" in
        ''|*[!0-9]*) ;;
        *)
            if [ "$LAST" -le "$NOW" ] && [ "$((NOW - LAST))" -lt "$((INTERVAL * 60))" ]; then
                exit 0
            fi;;
    esac
fi
# Written before probing, retaining the original retry-rate semantics.
printf 'uptime-v2 %s\n' "$NOW" > "$LAST_FILE" || exit 1

check_line() {
    local section="$1" enabled iface account password device user_ip url code backup_url backup_code
    config_get_bool enabled "$section" enabled 0
    [ "$enabled" = 1 ] || return 0
    [ "$(uci -q get gwifi.$section.manual_hold)" != 1 ] || return 0
    config_get iface "$section" iface
    config_get account "$section" account
    config_get password "$section" password
    if [ -z "$iface" ] || [ -z "$account" ] || [ -z "$password" ]; then
        logger -t gwifi "[$section] incomplete line configuration"
        return 0
    fi
    device=$(gwifi_device "$iface") || {
        logger -t gwifi "[$section] interface unavailable: $iface"
        return 0
    }
    user_ip=$(gwifi_ipaddr "$iface" "$device")
    gwifi_ipv4 "$user_ip" || {
        logger -t gwifi "[$section] interface has no usable IPv4 address"
        return 0
    }
    config_get url config check_url 'http://www.baidu.com'
    config_get code config check_code 200
    case "$url" in http://*|https://*) ;; *) logger -t gwifi 'Invalid check_url'; return 0;; esac
    case "$code" in 200|204) ;; *) logger -t gwifi 'Invalid check_code'; return 0;; esac
    # Online: return silently without calling an authentication endpoint.
    gwifi_probe "$device" "$url" "$code" && return 0
    gwifi_retry_allowed "$section" >/dev/null 2>&1 || return 0
    sleep 1
    # Confirm a transient failure before logging in; an optional independent
    # second target helps when the primary website alone is unavailable.
    config_get backup_url config backup_url
    config_get backup_code config backup_code 200
    [ -n "$backup_url" ] || { backup_url="$url"; backup_code="$code"; }
    case "$backup_url" in http://*|https://*) ;; *) logger -t gwifi 'Invalid backup_url'; return 0;; esac
    case "$backup_code" in 200|204) ;; *) logger -t gwifi 'Invalid backup_code'; return 0;; esac
    gwifi_probe "$device" "$backup_url" "$backup_code" && return 0
    logger -t gwifi "[$section/$device] offline checks failed; attempting login"
    if /bin/sh /usr/bin/gwifi-login "$section"; then
        logger -t gwifi "[$section/$device] authentication accepted"
    else
        logger -t gwifi "[$section/$device] login failed; retry on next scheduled pass"
    fi
}

network_flush_cache
config_foreach check_line line

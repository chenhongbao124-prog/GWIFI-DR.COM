#!/bin/sh
. /lib/functions.sh
. /lib/functions/network.sh
. /usr/lib/gwifi/common.sh
gwifi_operation_lock || exit 75
config_load gwifi
FAILED=0
repair_line() {
 local iface enabled
 config_get_bool enabled "$1" enabled 0
 [ "$enabled" = 1 ] || return 0
 config_get iface "$1" iface
 if /usr/bin/gwifi-auth-route "$iface"; then echo "[$1] 已按本线路实际网关检查路由";
 else echo "[$1] 无法修复，请检查网卡、IP 或网关"; FAILED=1; fi
}
config_foreach repair_line line
exit "$FAILED"

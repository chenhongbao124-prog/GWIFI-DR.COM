#!/bin/sh
# All mutating entry points share one inherited operation lock.
gwifi_operation_lock() {
 if [ "$GWIFI_OP_HELD" = 1 ] && [ "$(readlink /proc/$$/fd/9 2>/dev/null)" = "$(readlink -f /var/run/gwifi-check.lock)" ]; then return 0; fi
 exec 9>/var/run/gwifi-check.lock || return 1
 flock -n 9 || { echo '线路正在处理其他操作，请稍后重试。' >&2; return 75; }
 export GWIFI_OP_HELD=1
}
gwifi_uptime() { cut -d. -f1 /proc/uptime; }
gwifi_phase() {
 local s="$1"
 case "$s" in ''|*[!a-zA-Z0-9_]*) return 1;; esac
 mkdir -p /var/run/gwifi-state
 (umask 077; printf '%s\n' "$2" > /var/run/gwifi-state/$s.phase.tmp; mv /var/run/gwifi-state/$s.phase.tmp /var/run/gwifi-state/$s.phase)
 gwifi_uptime > /var/run/gwifi-state/$s.phase_at
}
gwifi_fingerprint() {
 local key
 for key in account password iface nas_name srv_ip aes_key spoof_device custom_ua; do uci -q get gwifi.$1.$key; done | sha256sum | awk '{print $1}'
}
gwifi_retry_allowed() {
 local s="$1" mode="$2" block fingerprint until now
 block=$(uci -q get gwifi.$s.auth_blocked_reason)
 fingerprint=$(gwifi_fingerprint "$s")
 if [ -n "$block" ] && [ "$(uci -q get gwifi.$s.auth_blocked_fingerprint)" = "$fingerprint" ] && [ "$mode" != manual ]; then
  gwifi_phase "$s" paused
  echo "认证已暂停（原因码 $block），请处理账号限制后点击重连。" >&2
  return 76
 fi
 until=$(cat /var/run/gwifi-state/$s.retry 2>/dev/null)
 case "$until" in ''|*[!0-9]*) until=0;; esac
 now=$(gwifi_uptime)
 if [ "$until" -gt "$now" ]; then
  gwifi_phase "$s" cooldown
  echo "正在等待重试，还需 $((until-now)) 秒。" >&2
  return 76
 fi
 return 0
}
gwifi_retry_failure() {
 local s="$1" reason="$2" n delay
 mkdir -p /var/run/gwifi-state
 n=$(cat /var/run/gwifi-state/$s.failures 2>/dev/null)
 case "$n" in ''|*[!0-9]*) n=0;; esac
 [ "$n" -lt 5 ] && n=$((n+1))
 echo "$n" > /var/run/gwifi-state/$s.failures
 delay=$((30 * (1 << n)))
 [ "$delay" -le 900 ] || delay=900
 case "$reason" in
  7) uci set gwifi.$s.auth_blocked_reason=7; uci set gwifi.$s.auth_blocked_fingerprint="$(gwifi_fingerprint "$s")"; gwifi_phase "$s" paused; delay=0;;
  43) delay=300; gwifi_phase "$s" cooldown;;
  rate_limit) delay=60; gwifi_phase "$s" cooldown;;
  *) gwifi_phase "$s" cooldown;;
 esac
 echo "$(($(gwifi_uptime)+delay))" > /var/run/gwifi-state/$s.retry
}
gwifi_retry_success() {
 rm -f /var/run/gwifi-state/$1.retry /var/run/gwifi-state/$1.failures
 uci -q delete gwifi.$1.auth_blocked_reason
 uci -q delete gwifi.$1.auth_blocked_fingerprint
 gwifi_phase "$1" authenticated
}
gwifi_check_connectivity() {
 local dev="$1" url="$2" expected="$3" ns="$4" backup bcode first rc target
 [ -n "$url" ] || config_get url config check_url http://www.baidu.com
 [ -n "$expected" ] || config_get expected config check_code 200
 config_get backup config backup_url http://connect.rom.miui.com/generate_204
 config_get bcode config backup_code 204
 [ -n "$backup" ] || { backup=http://connect.rom.miui.com/generate_204; bcode=204; }
 GWIFI_HTTP_CODE=; GWIFI_NET_REASON=unreachable
 for target in primary backup; do
  if [ "$target" = backup ]; then url="$backup"; expected="$bcode"; fi
  case "$url" in http://*|https://*) ;; *) GWIFI_NET_REASON=invalid_probe; return 1;; esac
  case "$expected" in 200|204) ;; *) GWIFI_NET_REASON=invalid_probe; return 1;; esac
  rc=0
  if [ -n "$ns" ]; then
   GWIFI_HTTP_CODE=$(ip netns exec "$ns" curl -4 --noproxy '*' -s --connect-timeout 2 --max-time 4 --proto '=http,https' --interface "$dev" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null) || rc=$?
  else
   GWIFI_HTTP_CODE=$(curl -4 --noproxy '*' -s --connect-timeout 2 --max-time 4 --proto '=http,https' --interface "$dev" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null) || rc=$?
  fi
  if [ "$rc" = 0 ] && [ "$GWIFI_HTTP_CODE" = "$expected" ]; then GWIFI_NET_REASON=online; return 0; fi
  [ "$target" != primary ] || first="$GWIFI_HTTP_CODE"
  case "$GWIFI_HTTP_CODE" in 301|302|303|307|308) GWIFI_NET_REASON=portal;; esac
  [ "$rc" != 6 ] || { [ "$GWIFI_NET_REASON" = portal ] || GWIFI_NET_REASON=dns; }
 done
 case "$first" in 301|302|303|307|308) GWIFI_HTTP_CODE="$first";; esac
 return 1
}

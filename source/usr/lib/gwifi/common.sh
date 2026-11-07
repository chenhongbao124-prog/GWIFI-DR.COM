#!/bin/sh

gwifi_device() {
    local gwifi_dev
    case "$1" in ''|*[!a-zA-Z0-9_.:-]*) return 1;; esac
    if network_get_device gwifi_dev "$1" && [ -n "$gwifi_dev" ]; then
        printf '%s\n' "$gwifi_dev"
        return 0
    fi
    ip link show dev "$1" >/dev/null 2>&1 || return 1
    printf '%s\n' "$1"
}

gwifi_ipaddr() {
    local gwifi_ip
    if network_get_ipaddr gwifi_ip "$1" && [ -n "$gwifi_ip" ]; then
        printf '%s\n' "$gwifi_ip"
        return 0
    fi
    ip -4 addr show dev "$2" 2>/dev/null |
        awk '/inet / { split($2,a,"/"); print a[1]; exit }'
}

gwifi_ipv4() {
    case "$1" in ''|*[!0-9.]*) return 1;; esac
    printf '%s\n' "$1" | awk -F. '
        NF != 4 { exit 1 }
        { for (i=1; i<=4; i++) if ($i == "" || length($i)>3 || $i+0>255) exit 1 }
    '
}

gwifi_hex() {
    printf '%s' "$1" | hexdump -v -e '/1 "%02x"' | tr -d ' \n\r'
}

gwifi_urlencode() {
    printf '%s' "$1" | hexdump -v -e '/1 "%02X "' | awk '{for(i=1;i<=NF;i++) printf "%%%s", $i}'
}

gwifi_html_value() {
    tr ">" "\n" | grep -F "name=\"$1\"" | head -1 | \
        sed -n "s/.*value=\"\([^\"]*\)\".*/\1/p" | \
        sed "s/&quot;/\"/g; s/&#39;/'/g; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\\&/g"
}

gwifi_probe() {
    gwifi_check_connectivity "$1" "$2" "$3"
}

gwifi_line_settings() {
 local key val
 for key in srv_ip nas_name aes_key; do
  config_get val "$1" "$key"
  [ -n "$val" ] || config_get val config "$key"
  case "$key" in srv_ip) SRV_IP="$val";; nas_name) NAS_NAME="$val";; aes_key) AES_KEY="$val";; esac
 done
}
gwifi_auth_reason() {
 printf '%s' "$1" | sed 's/\\"/"/g' | grep -oiE '"reasoncode"[[:space:]]*:[[:space:]]*"?[0-9]+' | head -1 | tr -cd '0-9'
}
gwifi_auth_message() {
 local reply="$1" message key
 json_load "$reply" >/dev/null 2>&1 || return
 for key in message msg reasonMessage reasonMsg errorMessage; do
  json_get_var message "$key"
  [ -z "$message" ] || { printf '%.400s' "$message"; return; }
 done
 for key in data result; do
  if json_select "$key" >/dev/null 2>&1; then
   for key in message msg reasonMessage reasonMsg errorMessage; do
    json_get_var message "$key"
    [ -z "$message" ] || { printf '%.400s' "$message"; return; }
   done
   json_select .. >/dev/null 2>&1
  fi
 done
}
gwifi_parent() {
 local dev="$1" parent n=0
 while [ "$n" -lt 8 ]; do
  parent=$(ip -o link show dev "$dev" 2>/dev/null | awk -F': ' '{print $2}' | cut -s -d@ -f2)
  case "$parent" in ''|if[0-9]*) break;; esac
  dev="$parent"; n=$((n+1))
 done
 printf '%s
' "$dev"
}

. /usr/lib/gwifi/runtime.sh

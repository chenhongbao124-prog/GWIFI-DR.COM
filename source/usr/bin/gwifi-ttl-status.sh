#!/bin/sh

if iptables -t mangle -L GWF_TTL -n >/dev/null 2>&1; then
    CHAIN=true
else
    CHAIN=false
fi

if iptables -t mangle -C POSTROUTING -j GWF_TTL 2>/dev/null; then
    HOOKED=true
else
    HOOKED=false
fi

IFACES=""
TTL_VALUE=""
RULES=""

if [ "$CHAIN" = "true" ]; then
    RAW=$(iptables -t mangle -L GWF_TTL -n -v -x 2>/dev/null | tail -n +3)
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        pkts=$(echo "$line" | awk '{print $1}')
        bytes=$(echo "$line" | awk '{print $2}')
        iface=$(echo "$line" | awk '{print $7}')
        ttl=$(echo "$line" | sed -n 's/.*TTL set to \([0-9]*\).*/\1/p')
        [ -z "$iface" ] && continue
        [ "$iface" = "*" ] && continue
        case "$pkts" in ''|*[!0-9]*) continue;; esac
        case "$bytes" in ''|*[!0-9]*) continue;; esac
        [ -z "$TTL_VALUE" ] && TTL_VALUE="$ttl"
        if [ -z "$IFACES" ]; then
            IFACES="\"$iface\""
            RULES="{\"iface\":\"$iface\",\"pkts\":$pkts,\"bytes\":$bytes}"
        else
            IFACES="$IFACES,\"$iface\""
            RULES="$RULES,{\"iface\":\"$iface\",\"pkts\":$pkts,\"bytes\":$bytes}"
        fi
    done <<EOT
$RAW
EOT
fi

printf '{"chain":%s,"hooked":%s,"ttl":"%s","ifaces":[%s],"rules":[%s]}\n' \
    "$CHAIN" "$HOOKED" "$TTL_VALUE" "$IFACES" "$RULES"

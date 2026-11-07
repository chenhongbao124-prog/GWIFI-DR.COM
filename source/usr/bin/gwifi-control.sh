#!/bin/sh
case "$1" in
 disconnect) exec /usr/bin/gwifi-soft-logout "$2";;
 restart) exec /usr/bin/gwifi-reconnect "$2";;
 *) exit 2;;
esac

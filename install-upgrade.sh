#!/bin/sh
set -e
umask 077
STAGE=/tmp/gwifi-stage
[ -f "$STAGE/SHA256SUMS" ] || { echo "缺少完整性校验文件"; exit 1; }
(cd "$STAGE" && sha256sum -c SHA256SUMS) || exit 1
FILES="usr/lib/gwifi/runtime.sh usr/lib/gwifi/common.sh usr/bin/gwifi-auth-route usr/bin/gwifi-route-ensure.sh usr/bin/gwifi-control.sh usr/bin/gwifi-routing usr/bin/gwifi-macvlan usr/bin/gwifi-get-interfaces usr/bin/gwifi-reconnect usr/bin/gwifi-soft-logout usr/bin/gwifi-login usr/bin/gwifi-cron.sh usr/bin/gwifi-cron-check usr/bin/gwifi-background usr/bin/gwifi-nas-watch usr/bin/gwifi-nas-daemon usr/bin/gwifi-handover usr/bin/gwifi-status usr/bin/gwifi-detect usr/bin/gwifi-env-check usr/bin/gwifi-dep-check usr/bin/gwifi-ttl-guard usr/bin/gwifi-ttl-status.sh usr/bin/gwifi-sync-ttl.sh usr/bin/gwifi-rollback etc/init.d/gwifi etc/hotplug.d/iface/99-gwifi-auth-route www/luci-static/resources/view/gwifi/main.js www/luci-static/resources/view/gwifi/env.js www/luci-static/resources/view/gwifi/macvlan.js www/luci-static/resources/view/gwifi/ttl.js www/luci-static/resources/view/gwifi/log.js usr/share/rpcd/acl.d/luci-app-gwifi.json etc/gwifi-release www/luci-static/resources/view/gwifi/about.js usr/share/luci/menu.d/luci-app-gwifi.json www/luci-static/resources/view/gwifi/intro.js"
for f in $FILES; do
 [ -f "$STAGE/$f" ] || exit 1
 case "$f" in usr/bin/*|usr/lib/*|etc/init.d/*|etc/hotplug.d/*) sh -n "$STAGE/$f";; esac
done
exec 9>/var/run/gwifi-check.lock
flock -n 9 || { echo "线路正在处理中，请稍后重新安装"; exit 75; }
mkdir -p /root/gwifi-backups
BACKUP=$(mktemp -d /root/gwifi-backups/release-XXXXXX)
: > "$BACKUP/existing"; : > "$BACKUP/absent"
for f in $FILES etc/gwifi-release-backup; do
 if [ -f "/$f" ]; then echo "$f" >> "$BACKUP/existing"; else echo "$f" >> "$BACKUP/absent"; fi
done
tar -czf "$BACKUP/files.tar.gz" -C / -T "$BACKUP/existing"
tar -czf "$BACKUP/config.tar.gz" -C / etc/config/gwifi etc/config/network etc/config/firewall
rollback_failed_install() {
 rc=$?
 if [ "$rc" != 0 ]; then
  tar -xzf "$BACKUP/files.tar.gz" -C /
  while IFS= read -r f; do rm -f "/$f"; done < "$BACKUP/absent"
  flock -u 9
  if [ -x /etc/init.d/gwifi ]; then /etc/init.d/gwifi start || true; fi
  echo "安装未通过检查，已恢复程序文件。备份：$BACKUP"
 fi
}
trap rollback_failed_install EXIT
if [ -x /etc/init.d/gwifi ]; then /etc/init.d/gwifi stop; fi
for f in $FILES; do
 mkdir -p "$(dirname "/$f")"
 cp "$STAGE/$f" "/$f"
 case "$f" in usr/bin/*|etc/init.d/*|etc/hotplug.d/*) chmod 755 "/$f";; *) chmod 644 "/$f";; esac
done
echo "$BACKUP" > /etc/gwifi-release-backup
for page in main ttl about env; do
 code=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" "http://127.0.0.1/luci-static/resources/view/gwifi/$page.js")
 [ "$code" = 200 ] || { echo "页面加载失败: $page HTTP $code"; exit 1; }
done
for cache in /tmp/luci-indexcache.*.json; do [ ! -f "$cache" ] || rm -f "$cache"; done
/etc/init.d/rpcd reload
flock -u 9
/etc/init.d/gwifi start
echo "INSTALL_OK $(cat /etc/gwifi-release)"
echo "备份：$BACKUP"
echo "恢复程序：/usr/bin/gwifi-rollback"

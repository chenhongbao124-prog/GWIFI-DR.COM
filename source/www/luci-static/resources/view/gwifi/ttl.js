'use strict';
'require view';
'require fs';
'require uci';
'require ui';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('gwifi'),
            fs.exec('/usr/bin/gwifi-ttl-status.sh').then(function(r) {
                try { return JSON.parse(r.stdout || '{}'); } catch(e) { return {}; }
            }).catch(function() { return {}; }),
            fs.exec('/sbin/logread', ['-e', 'gwifi-ttl']).then(function(r) {
                return (r.stdout || '').trim();
            }).catch(function() { return ''; })
        ]);
    },
    render: function(data) {
        var view = this;
        var d = data[1] || {};
        var logData = data[2] || '';
        var currentTtl = uci.get('gwifi', 'config', 'default_ttl') || '0';

        var m = E('div', { class: 'cbi-map' }, [
            E('h2', {}, 'IPv4 TTL 检查与修复'),
            E('p', { style: 'color: #666; margin-bottom: 20px;' }, '系统会根据每条线路的【伪装设备类型】自动分配 TTL（电脑为 128，手机/平板为 64）。由独立后台检查维护，与掉线重连分开。规则检查通过不等于已经抓包验证。')
        ]);

        // ======== 全局 TTL 配置区 ========
        var configDiv = E('div', { style: 'padding:15px; background:#fff; border:1px solid #ddd; border-radius:4px; margin-bottom:20px;' }, [
            E('h3', { style: 'margin-top:0;' }, '⚙️ TTL 规则设置'),
            E('div', { style: 'display:flex; align-items:center; gap:10px;' }, [
                E('label', { style: 'font-weight:bold;' }, '全局 TTL 强制覆盖：'),
                E('select', { id: 'global_ttl', class: 'cbi-input-select', style: 'width:200px;' }, [
                    E('option', { value: '0', selected: (currentTtl === '0') ? 'selected' : null }, '跟随线路伪装 (推荐)'),
                    E('option', { value: '64', selected: (currentTtl === '64') ? 'selected' : null }, '强制所有接口统一 64'),
                    E('option', { value: '128', selected: (currentTtl === '128') ? 'selected' : null }, '强制所有接口统一 128')
                ]),
                E('button', { class: 'btn cbi-button cbi-button-action', click: function(ev) {
                    ev.preventDefault();
                    var ttlVal = document.getElementById('global_ttl').value;
                    uci.set('gwifi', 'config', 'default_ttl', ttlVal);
                    uci.save().then(function() {
                        return uci.commit('gwifi');
                    }).then(function() {
                        ui.addNotification(null, E('p', {}, 'TTL 配置已保存并提交'), 'info');
                        // 立刻执行规则刷新
                        fs.exec('/usr/bin/gwifi-sync-ttl.sh').then(function() {
                            setTimeout(function() { location.reload(); }, 1000);
                        });
                    });
                } }, '保存并应用')
            ]),
            E('p', { style: 'font-size:12px; color:#666; margin-top:10px;' }, '默认按线路的设备类型选择 TTL；规则存在和计数增长不等于已验证出口报文。')
        ]);
        m.appendChild(configDiv);
var watch=E('input',{type:'checkbox',checked:uci.get('gwifi','config','ttl_watch')!=='0'});
var period=E('select',{},[1,3,5,10,15,30,60].map(function(n){return E('option',{value:String(n)},n+' 分钟');}));period.value=uci.get('gwifi','config','ttl_interval')||'3';
m.appendChild(E('div',{style:'padding:15px'},[E('label',{},[watch,' 独立检查 TTL 并自动修复 ']),period,E('button',{class:'btn',click:function(ev){ev.preventDefault();uci.set('gwifi','config','ttl_watch',watch.checked?'1':'0');uci.set('gwifi','config','ttl_interval',period.value);uci.save().then(function(){return uci.commit('gwifi');}).then(function(){location.reload();});}},'保存检查设置')]));
var events=E('div',{});m.appendChild(events);fs.exec('/usr/bin/gwifi-ttl-guard',['status']).then(function(r){var d=JSON.parse(r.stdout||'{}');events.appendChild(E('p',{},'最近检查：'+(d.last_check||'尚未检查')));if(d.warning)events.appendChild(E('p',{style:'color:#b45309;font-weight:bold'},d.warning));events.appendChild(E('pre',{style:'white-space:pre-wrap'},d.history||'暂无修复记录'));events.appendChild(E('button',{class:'btn',click:function(ev){ev.preventDefault();fs.exec('/usr/bin/gwifi-ttl-guard',['ack']).then(function(){location.reload();});}},'我已看到，清除提醒（保留记录）'));}).catch(function(){});

        // ======== TTL 状态区 ========
        var ok = d.chain && d.hooked && d.ifaces && d.ifaces.length > 0;
        var statusDiv = E('div', { style: 'padding:15px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;' }, [
            E('div', { style: 'font-size:16px;font-weight:bold;margin-bottom:10px;' }, 'TTL 统一与防查水表'),
            E('div', { style: 'margin-bottom:6px;' }, [
                E('span', {}, '状态：'), 
                E('span', { style: 'font-weight:bold; color:' + (ok ? '#28a745' : '#d9534f') + ';' }, ok ? '✅ 规则已安装（未抓包验证）' : '⚠️ 未启用')
            ]),
            E('div', { style: 'margin-bottom:6px; color:#666;' }, '覆盖接口：' + (d.ifaces || '无')),
            E('div', { style: 'margin-bottom:15px;' }, [
                ok ? '✅ 已挂载到 POSTROUTING' : '❌ 未挂载'
            ]),
            E('button', { class: 'btn cbi-button-action', style: 'margin-right:10px;', click: function(ev) {
                ev.preventDefault();
                fs.exec('/usr/bin/gwifi-sync-ttl.sh').then(function() {
                    ui.addNotification(null, E('p', {}, '规则已立即同步'), 'info');
                    setTimeout(function() { location.reload(); }, 1000);
                });
            } }, '立即同步 TTL 规则'),
            E('button', { class: 'btn cbi-button', click: function(ev) {
                ev.preventDefault(); location.reload();
            } }, '刷新状态与日志')
        ]);
        m.appendChild(statusDiv);

        // ======== 命中统计区 ========
        var statsDiv = E('div', { style: 'padding:15px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;' }, [
            E('div', { style: 'font-size:16px;font-weight:bold;margin-bottom:10px;' }, '规则命中统计'),
            E('table', { class: 'table', style: 'width:100%; text-align:left;' }, [
                E('thead', {}, [ E('tr', {}, [ E('th', {}, '接口'), E('th', {}, '命中包数'), E('th', {}, '字节数') ]) ]),
                E('tbody', {}, (d.rules || []).map(function(r) {
                    return E('tr', {}, [ E('td', {}, r.iface), E('td', {}, r.pkts), E('td', {}, r.bytes) ]);
                }))
            ])
        ]);
        m.appendChild(statsDiv);

        // ======== 日志区 ========
        var logDiv = E('div', { style: 'padding:15px;background:#1e1e1e;color:#d4d4d4;border-radius:4px;margin-bottom:15px;font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow:auto;' }, logData || '暂无日志');
        m.appendChild(E('h3', {}, '最近同步日志 (标签 gwifi-ttl)'));
        m.appendChild(logDiv);

        return m;
    }
});

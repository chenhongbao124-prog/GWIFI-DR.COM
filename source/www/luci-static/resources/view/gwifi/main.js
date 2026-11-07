'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';

var STATUS_COLOR = { disabled: 'red', online: 'green', offline: 'red', unknown: 'gray', logged_out: 'orange', reconnecting: 'blue' };
var STATUS_TEXT = { disabled: '已停用', online: '在线', offline: '离线', unknown: '未知', logged_out: '已软下线', reconnecting: '重连中' };

function showGwifiWarning(kind, message) {
    if (!message) return;
    var key='gwifi.dismissed-warning.v1.'+kind;
    try { if(window.localStorage.getItem(key)===message)return; } catch(e) {}
    var hide=E('input',{type:'checkbox'});
    var hint=E('small',{style:'display:block;margin:6px 0;'},'仅在本浏览器记住；新消息仍会提醒，日志仍保留。');
    var notice;
    var body=E('div',{},[
        E('p',{style:'white-space:pre-wrap;'},message),
        E('label',{style:'display:block;cursor:pointer;'},[hide,' 不再弹出本条消息']),
        hint,
        E('button',{class:'btn cbi-button',click:function(ev){
            ev.preventDefault();
            if(hide.checked){
                try{window.localStorage.setItem(key,message);}catch(e){
                    hint.textContent='浏览器无法保存此选择，请取消勾选后关闭；刷新后可能再次提醒。';
                    return;
                }
            }
            if(notice&&notice.parentNode)notice.parentNode.removeChild(notice);
        }},'好的，我知道了')
    ]);
    notice=ui.addNotification(null,body,'warning');
    // The host appends a separate Dismiss button; keep one acknowledgement action.
    if(notice&&notice.children&&notice.children.length===2)notice.children[1].style.display='none';
}

function showGwifiIntro() {
    var key = 'gwifi.intro.dismissed.v1';
    try { if (window.localStorage.getItem(key) === '1') return; } catch (e) {}
    var skip = E('input', { type: 'checkbox', id: 'gwifi-intro-skip' });
    var done = E('button', { class: 'btn cbi-button cbi-button-action', style: 'margin-top:14px', click: function(ev) {
        ev.preventDefault();
        if (skip.checked) {
            try { window.localStorage.setItem(key, '1'); }
            catch (e) { hint.textContent = '浏览器未能保存此选择；关闭后下次仍会显示说明。'; return; }
        }
        ui.hideModal();
    } }, '好的，我知道了');
    var hint = E('small', { style: 'display:block;margin-top:8px;color:#65727a' }, '勾选后仅在本浏览器记住；也可随时从“插件介绍”重新查看。');
    ui.showModal('欢迎使用 Gwifi', [
        E('div', { style: 'max-width:620px' }, [
            E('div', { style: 'padding:16px 18px;border-left:5px solid #16825d;background:#edf7f2;border-radius:4px;margin-bottom:14px' }, [
                E('strong', { style: 'font-size:18px;color:#145b45' }, '校园网认证与多线路管理'),
                E('p', { style: 'margin:6px 0 0' }, '基础认证可独立运行；Clash 是可选的流量管理工具。')
            ]),
            E('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px' }, [
                E('div', { style: 'padding:12px;background:#f4f8fa;border-top:3px solid #16825d' }, [E('strong', {}, '线路'), E('p', { style: 'margin:4px 0 0' }, '物理口与虚拟网卡多拨')]),
                E('div', { style: 'padding:12px;background:#f4f8fa;border-top:3px solid #2878a5' }, [E('strong', {}, '维护'), E('p', { style: 'margin:4px 0 0' }, '掉线重连与 NAS 记录')]),
                E('div', { style: 'padding:12px;background:#f4f8fa;border-top:3px solid #ca7b20' }, [E('strong', {}, '检测'), E('p', { style: 'margin:4px 0 0' }, '独立 TTL 检查与提醒')])
            ]),
            E('p', { style: 'margin:14px 0 6px' }, '当前适配 gportal 网页认证流程，不能保证所有 Dr.COM 校园网都通用。基础功能已验证；完整在线 NAS 迁移与 Clash 联动仍需实测。'),
            E('label', { for: 'gwifi-intro-skip', style: 'display:block;cursor:pointer' }, [skip, ' 以后不再弹出']),
            hint,
            done
        ])
    ]);
}

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('gwifi'),
            fs.exec('/usr/bin/gwifi-status').then(function(r){try{return JSON.parse(r.stdout||'[]');}catch(e){return [];}}).catch(function(){return [];}),
            fs.exec('/usr/bin/gwifi-get-interfaces').then(function(r){try{return JSON.parse(r.stdout||'[]');}catch(e){return [];}}).catch(function(){return [];}),
            fs.exec('/usr/bin/gwifi-nas-watch',['status']).then(function(r){return JSON.parse(r.stdout||'{}');}).catch(function(){return {};}),
            fs.exec('/usr/bin/gwifi-ttl-guard',['status']).then(function(r){return JSON.parse(r.stdout||'{}');}).catch(function(){return {};})
        ]).then(function(data){
            window.gwifiNasLines=data[3].lines||[];
            window.gwifiNasStatus=data[3];
            showGwifiWarning('ttl',data[4].warning);
            return data;
        });
    },
    getUaString: function(dev, custom) {
        if (dev === 'custom') return custom || '未填写自定义 UA';
        if (dev === 'tablet') return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
        if (dev === 'phone') return 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
        if (dev === 'pc') return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        if (dev === 'ipad') return 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
        if (dev === 'iphone') return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
        if (dev === 'android') return 'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
        return '未知';
    },

    doDetect: function() {
        var hasOnline = false;
        for (var k in this.statusData) {
            if (this.statusData[k].status === 'online') {
                hasOnline = true;
                break;
            }
        }
        if (hasOnline) {
            ui.addNotification(null, E('p', {}, '⚠️ 检测到当前有线路在线！请先将所有线路“软下线”，再进行自动探测。'), 'danger');
            return;
        }
        
        ui.showModal('自动探测', [ E('p', { class: 'spinning' }, '正在尝试探测 NAS 和服务器 IP，请稍候...') ]);
        fs.exec('/usr/bin/gwifi-detect').then(function(res) {
            ui.hideModal();
            ui.addNotification(null, E('p', {}, '探测完成，即将刷新页面'), 'info');
            setTimeout(function() { window.location.reload(); }, 1500);
        }).catch(function(e) {
            ui.hideModal();
            ui.addNotification(null, E('p', {}, '探测执行异常'), 'danger');
        });
    },

    doAction: function(section, action) {
        var script = action === 'logout' ? '/usr/bin/gwifi-soft-logout' : '/usr/bin/gwifi-reconnect';
        ui.showModal('处理中', [E('p', { class: 'spinning' }, '正在执行操作，请稍候...')]);
        fs.exec(script, [section]).then(function(r) {
            ui.hideModal();
            if (r.code === 0) {
                ui.addNotification(null, E('p', {}, '操作成功'), 'info');
            } else {
                ui.addNotification(null, E('p', {}, ((r.stdout||'')+' '+(r.stderr||'')).indexOf('REASON:7')>=0 ? '⚠️ 该账号绑定次数已用完（reasoncode=7），请去 gwifi APP 点“自助解绑设备”重置绑定次数，或联系在线客服。' : ((r.stdout||'')+' '+(r.stderr||'')).indexOf('REASON:43')>=0 ? '⚠️ 同类型设备互踢（reasoncode=43），已尝试自动 rebind。若反复出现，请去 APP 查在线设备。' : '操作失败: ' + (r.stderr || r.stdout)), 'danger');
            }
            setTimeout(function() { window.location.reload(); }, 1000);
        }).catch(function(e) {
            ui.hideModal();
            ui.addNotification(null, E('p', {}, '执行异常'), 'danger');
        });
    },

    render: function(data) {
        var view = this;
        var statusData = {};
        (data[1] || []).forEach(function(d) { statusData[d.section] = d; });
        view.statusData = statusData;
        var netIfaces = data[2] || [];

        var m = new form.Map('gwifi', '校园网认证 (Gwifi)');
        var s = m.section(form.NamedSection, 'config', 'gwifi', '服务器与检测设置');
        s.anonymous = true;
        
        var detectBtn = E('button', { class: 'btn cbi-button cbi-button-action', style: 'margin-bottom: 5px;', click: function(ev) { ev.preventDefault(); view.doDetect(); } }, '🔍 自动探测 IP 和 NAS');
        var detectDesc = E('div', { style: 'color:#d9534f; font-size:12px;' }, '测试功能，如不可用请自行解决。*注：必须所有线路离线才可探测*');
        s.option(form.DummyValue, '_detect', '快捷操作').renderWidget = function() { return E('div', {}, [detectBtn, detectDesc]); };
        
        var o = s.option(form.Value, 'srv_ip', '认证服务器 IPv4');
        o.placeholder = '认证服务器 IP'; o.datatype = 'ip4addr'; o.rmempty = false;
        o = s.option(form.Value, 'nas_name', 'NAS 名称'); o.placeholder = '填写认证系统提供的名称'; o.rmempty = false;
        o = s.option(form.Value, 'aes_key', 'AES 密钥'); o.password = true; o.rmempty = false; o.description = '16 位 ASCII 字符';
        o.validate = function(section, v) { return /^[\x20-\x7e]{16}$/.test(v) ? true : '必须是 16 个 ASCII 字符'; };
        
        o = s.option(form.Flag, 'enable_cron', '开启后台自动检测重连 (Cron 保活)');
        o.default = '1'; o.rmempty = false;
        o.description = '按下方间隔检查网络，掉线自动重连。此开关不控制 TTL 检查和 NAS 监控。';

        o = s.option(form.ListValue, 'interval', '最短检测间隔');
        [3, 5, 10, 15, 30, 60].forEach(function(min) { o.value(String(min), min + ' 分钟'); });
        o.default = '10'; o.rmempty = false; o.description = '检测掉线的最小间隔，推荐 10 分钟。';
        
        o = s.option(form.Value, 'check_url', '联网检测网址'); o.default = 'http://www.baidu.com'; o.rmempty = false;
        o = s.option(form.ListValue, 'check_code', '预期状态码'); o.value('200', '200'); o.value('204', '204'); o.default = '200'; o.rmempty = false;
        o = s.option(form.ListValue, 'payload_encoding', '认证参数编码');
        o.value('legacy', '沿用原版'); o.value('form', 'URL 编码（推荐）'); o.default = 'form'; o.rmempty = false;
        
        o = s.option(form.Flag, 'rebind', '允许自动重新绑定 MAC');

        o = s.option(form.Flag, 'nas_monitor', '开启 NAS 名称变化监控');
        o.default = '0';
        o.rmempty = false;
        o.description = '每条线路分别检查，不修改其他线路。先复查变化，再使用同网口空闲账号验证；在线时网关可能不提供 NAS 信息。';

        o = s.option(form.ListValue, 'nas_check_interval', 'NAS 检测间隔');
        o.value('1', '1 分钟');
        o.value('3', '3 分钟');
        o.value('5', '5 分钟');
        o.value('10', '10 分钟');
        o.default = '3';
        o.depends('nas_monitor', '1');
        o.default = '1'; o.description = '收到 reasoncode=43 时自动 rebind。开启后可能在别的设备上被踢下线。';

        s = m.section(form.TypedSection, 'line', '线路与账户', '每条 line 对应一个认证会话。启用 = cron 自动保活；禁用（软下线）= 保留 IP 但不再认证，用于占位。');
        s.anonymous = false; s.addremove = true; s.addbtntitle = '添加线路';

        o = s.option(form.Flag, 'enabled', '启用此线路'); o.default = '1'; o.rmempty = false;
        
        o = s.option(form.ListValue, 'iface', '绑定网口');
        o.rmempty = false; o.description = '选择用于认证的网卡设备。如果没有，请去“虚拟网卡”页面创建。';
        netIfaces.forEach(function(iface) { o.value(iface, iface); });
        o.default = 'wan';

        o = s.option(form.Value, 'nas_name', '此线路的 NAS'); o.placeholder = '留空使用上面的默认值'; o.description='每条认证线路分别记录，其他网卡的变化不会一起修改它。';
        o = s.option(form.Value, 'srv_ip', '此线路的认证服务器'); o.datatype='ip4addr'; o.rmempty=true;
        o = s.option(form.Value, 'aes_key', '此线路的 AES 密钥'); o.password=true; o.rmempty=true;
        o = s.option(form.Flag, 'nas_spare', '允许空闲时用于尝试新 NAS'); o.default='1'; o.description='自动选择同网口的空闲账号。允许备用的停用线路可能在验证时自动启用。';
        o = s.option(form.DummyValue, '_nas_observation', 'NAS 检查结果'); o.cfgvalue=function(id){var d=(window.gwifiNasLines||[]).filter(function(x){return x.section===id;})[0]||{};return (d.checked?'最近检查：'+d.checked+'。':'')+(d.note||'尚未检查');};
        o = s.option(form.DummyValue, 'pending_nas', '备用连接已验证的 NAS（待本线路确认）'); o.cfgvalue=function(id){return uci.get('gwifi',id,'pending_nas')||'尚无备用连接验证成功';};
        o = s.option(form.DummyValue, '_nas_detected', '最近发现的 NAS'); o.cfgvalue=function(id){var d=(window.gwifiNasLines||[]).filter(function(x){return x.section===id;})[0]||{};return d.detected||'网关尚未提供';};
        o = s.option(form.Value, 'account', '账号'); o.rmempty = false;
        
        o = s.option(form.Value, 'password', '密码'); o.password = true; o.rmempty = false;
        o.renderWidget = function() { 
            var el = form.Value.prototype.renderWidget.apply(this, arguments);
            var input = el.querySelector('input');
            if (input) input.setAttribute('autocomplete', 'new-password');
            return el; 
        };

        o = s.option(form.ListValue, 'spoof_device', '伪装设备类型');
        o.value('pc', 'PC (Windows)'); o.value('phone', '手机 (iPhone)'); o.value('tablet', '平板 (Macintosh)'); 
        o.value('ipad', 'iPad (旧版)'); o.value('iphone', 'iPhone (旧版)'); o.value('android', 'Android (旧版)'); o.value('custom', '自定义 Custom');
        o.default = 'pc'; o.rmempty = false; o.description = '选择认证时伪装成的设备类型。*注：必须软下线后才能更改*；⚠️ 修改后必须点页面底部【保存并应用】，否则点【重连】仍用旧 UA';
        
        o.renderWidget = function(section_id) {
            var el = form.ListValue.prototype.renderWidget.apply(this, arguments);
            var d = statusData[section_id] || {};
            if (d.status === 'online' || d.status === 'reconnecting') {
                setTimeout(function() {
                    var sel = el.querySelector('select');
                    if (sel) {
                        sel.disabled = true;
                        sel.style.backgroundColor = '#eee';
                        sel.style.cursor = 'not-allowed';
                        sel.title = '必须软下线后才能更改设备类型';
                    }
                }, 50);
            }
            return el;
        };
        
        o.onchange = function(ev, section_id) {
            var preview = document.getElementById('ua_preview_' + section_id);
            if (preview) {
                var custom = uci.get('gwifi', section_id, 'custom_ua') || '';
                preview.textContent = view.getUaString(ev.target.value, custom);
            }
        };
        
        o = s.option(form.Value, 'custom_ua', '自定义 User-Agent'); o.rmempty = true; o.depends('spoof_device', 'custom');
        o.onchange = function(ev, section_id) {
            var preview = document.getElementById('ua_preview_' + section_id);
            var sel = document.getElementById('widget.cbid.gwifi.' + section_id + '.spoof_device');
            var dev = sel ? sel.value : 'pc';
            if (preview) preview.textContent = view.getUaString(dev, ev.target.value);
        };
        
        o = s.option(form.DummyValue, '_ua_preview', '实际生效的 User-Agent');
        o.rawhtml = true;
        o.renderWidget = function(section_id) {
            var dev = uci.get('gwifi', section_id, 'spoof_device') || 'pc';
            var custom = uci.get('gwifi', section_id, 'custom_ua') || '';
            return E('span', { id: 'ua_preview_' + section_id, style: 'color:#666; word-break:break-all;' }, view.getUaString(dev, custom));
        };

        o = s.option(form.DummyValue, '_status', '实时状态与操作');
        o.rawhtml = true;
        o.renderWidget = function(section_id) {
            var d = statusData[section_id] || { status: 'unknown', iface: '', device: '', ip: '', nas: '', error: '' };
            var isEnabled = (d.enabled === 1 || d.enabled === '1' || d.enabled === true);
            var uiStatus = isEnabled ? d.status : 'disabled';
            var color = STATUS_COLOR[uiStatus] || (isEnabled ? '#777' : '#d9534f');
            var text = STATUS_TEXT[uiStatus] || (isEnabled ? (d.status || '未知') : '⛔ 已停用');
            var btnLogout = E('button', { class: 'btn cbi-button cbi-button-remove', disabled: (uiStatus !== 'online') ? true : null, click: function(ev) { ev.preventDefault(); view.doAction(section_id, 'logout'); } }, '⏸ 软下线（保留 IP）');
            var btnReconnect = E('button', { class: 'btn cbi-button cbi-button-action', style: 'margin-left:8px;', disabled: (uiStatus === 'online') ? true : null, click: function(ev) { ev.preventDefault(); view.doAction(section_id, 'reconnect'); } }, '↻ 重连');
            var btnRefresh = E('button', { class: 'btn cbi-button', style: 'margin-left:8px;', click: function(ev) { ev.preventDefault(); window.location.reload(); } }, '🔄 刷新状态');
            var reason=d.auth_reason||'';
            var reasons={'7':'绑定名额或次数已用完，请在校园网 APP 查看解绑选项或联系客服','43':'同类型设备互踢／设备绑定冲突，请检查账号在线设备','unknown':'认证被拒绝，未提供可识别原因码'};
            var errorMsg=reason?(d.auth_message||reasons[reason]||'认证未通过')+(/^\d+$/.test(reason)?'（原因码：'+reason+'）':'')+(d.auth_time?'；发生时间：'+d.auth_time.replace('_',' '):''):'';
            var extraText='';
            var netNames={no_device:'找不到网卡',no_ip:'尚未取得 IP',namespace_missing:'隔离网卡尚未启动',dns:'域名解析失败',unreachable:'检测目标无法访问',invalid_probe:'联网检测设置无效',portal:'收到网页跳转，请检查认证状态'};
            var liveMsg=!isEnabled?'此线路已停用，未进行联网检查':'当前联网检查：'+(d.probe_code?'HTTP '+d.probe_code+'，':'')+(uiStatus==='online'?'可正常上网':netNames[d.net_reason]||'尚未确认外网可用');
            var progress=d.blocked_reason?'自动认证已暂停（原因码 '+d.blocked_reason+'）；处理账号限制后点击重连。':d.retry_seconds>0?'等待重试：约 '+d.retry_seconds+' 秒（刷新可更新）':d.phase==='authenticating'?'正在认证，请稍候。':'';
            var historyAttrs={style:'color:#666;font-size:13px;margin-bottom:8px;'};
            if(uiStatus==='offline')historyAttrs.open=true;
            return E('div', { style: 'padding:10px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;' }, [
                E('div', { style: 'margin-bottom:8px;' }, [
                    E('strong', {}, '状态：'), 
                    E('span', { style: 'color:' + color + ';font-weight:bold;' }, text + extraText),
                    E('span', { style: 'color:#999;margin-left:15px;' }, 'NAS: ' + (d.nas || '-') + ' | MAC: ' + (d.mac || '-') + ' | IP: ' + (d.ip || '无'))
                ]),
                E('div', { style: 'color:'+(uiStatus==='online'?'#22863a':uiStatus==='offline'?'#d9534f':'#666')+';font-size:13px;margin-bottom:8px;' }, liveMsg),
                progress?E('div',{style:'color:#856404;margin-bottom:8px;'},progress):'',
                errorMsg ? E('details', historyAttrs, [
                    E('summary', {style:'cursor:pointer;'}, uiStatus==='online'?'上次失败记录（当前已在线，展开查看）':'上次认证失败记录'),
                    E('div', {style:'margin-top:6px;white-space:pre-wrap;'}, errorMsg),
                    E('div', {style:'margin-top:4px;'}, '这是过去的记录，不代表当前联网状态。')
                ]) : (uiStatus==='offline'?E('div',{style:'color:#666;font-size:13px;margin-bottom:8px;'},'尚未取得认证失败详情；重连后可查看本次认证结果。'):''),
                E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
                    btnLogout, btnReconnect, btnRefresh
                ])
            ]);
        };
        
        return m.render().then(function(el){
            var roles={primary:'主出口',secondary:'独立线路',handover:'正在承接新连接'};
            var stages={active:'备用已接替新连接',fallback:'备用异常，新连接已回主出口',verified_nondefault:'备用已验证，未切换出口',retry_handover:'出口接替待重试',verified:'备用认证已验证'};
            var rows=(data[1]||[]).map(function(x){return E('tr',{},[
                E('td',{},x.section),E('td',{},(x.parent||'-')+' / '+(x.device||x.iface||'-')),
                E('td',{},(x.configured_nas||x.nas||'-')+' / '+(x.detected_nas||'尚未发现')),
                E('td',{},STATUS_TEXT[x.enabled?x.status:'disabled']||'未知'),
                E('td',{},roles[x.role]||'独立线路'),
                E('td',{},x.blocked_reason?'认证暂停：'+x.blocked_reason:x.retry_seconds>0?'等待 '+x.retry_seconds+' 秒':stages[x.migration]|| (x.phase==='authenticating'?'正在认证':'常规检查'))
            ]);});
            var wrapper=E('div',{},[E('h3',{},'线路总览'),E('div',{style:'overflow-x:auto;'},[E('table',{class:'table'},[
                E('thead',{},[E('tr',{},['线路','所属网口 / 网卡','设置 NAS / 最近发现','联网状态','出口角色','当前处理'].map(function(t){return E('th',{},t);}))]),E('tbody',{},rows)
            ])])]);
            wrapper.appendChild(el);
            var d=window.gwifiNasStatus||{};showGwifiWarning('nas',d.warning);el.appendChild(E('h3',{},'NAS 检查与迁移记录'));el.appendChild(E('pre',{style:'white-space:pre-wrap'},d.history||'暂无变化记录'));
            showGwifiIntro();
            return wrapper;
        });
    }
});

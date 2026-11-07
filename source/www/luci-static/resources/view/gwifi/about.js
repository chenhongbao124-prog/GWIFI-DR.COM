'use strict';
'require view';
'require fs';
'require uci';
'require ui';

// Pure generator: never export credentials or change the network.
function gwifiReferenceYaml(mode, devices, healthUrl) {
    var quote = JSON.stringify;
    var lines = [
        '# Gwifi · Mihomo 基础参考配置（不是机场订阅）',
        '# 仅供参考：先备份现有配置，再按自己的需求修改和测试。',
        '# 校园网认证仍由 Gwifi 完成；这里不包含账号、密码、AES 密钥或 NAS。',
        '# 只监听路由器本机 127.0.0.1:7890，不接管 LAN、DNS 或系统路由。',
        '# OpenClash 等管理器可能覆盖这些设置，导入前请核对其运行模式。',
        '# 未配置代理服务器，不能提供机场代理能力。',
        'mixed-port: 7890',
        'allow-lan: false',
        'bind-address: "127.0.0.1"',
        'mode: rule',
        'log-level: info',
        'ipv6: false',
        'tun:',
        '  enable: false',
        'dns:',
        '  enable: false'
    ];
    if (mode === 'multi') {
        var seen = {};
        devices = devices.filter(function(d) {
            if (typeof d !== 'string' || !/^[a-zA-Z0-9_.:-]{1,15}$/.test(d) || d === 'lo')
                throw new Error('网卡名称无效，请刷新页面后重新选择。');
            if (seen[d]) return false;
            seen[d] = true; return true;
        });
        if (devices.length < 2) throw new Error('多线路示例至少需要勾选两张不同网卡；只有一条线路时请选择基础直连。');
        var parsed;
        try { parsed = new URL(healthUrl); } catch (e) {}
        if (!parsed || !/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || /[\s"\\]/.test(healthUrl))
            throw new Error('请填写不含账号密码的 http:// 或 https:// 检测地址。');
        lines.push('', '# 仅选择已认证、有 IPv4 地址并能独立联网的网卡。',
            '# 网卡不存在、没有对应出口路由、或处于独立网络空间时不能直接使用。',
            '# 本例不设置 routing-mark；与 NAS 接替、其他分流插件的配合需要单独验证。', 'proxies:');
        var names = devices.map(function(d, i) {
            var name = '线路' + (i + 1) + ' · ' + d;
            lines.push('  - name: ' + quote(name), '    type: direct', '    udp: true',
                '    ip-version: ipv4', '    interface-name: ' + quote(d));
            return name;
        });
        lines.push('', 'proxy-groups:', '  - name: "校园网出口"', '    type: select',
            '    proxies:', '      - DIRECT', '      - "多线路均衡"');
        names.forEach(function(n) { lines.push('      - ' + quote(n)); });
        lines.push('  - name: "多线路均衡"', '    type: load-balance',
            '    strategy: consistent-hashing', '    url: ' + quote(healthUrl),
            '    interval: 300', '    lazy: false', '    expected-status: 204', '    proxies:');
        names.forEach(function(n) { lines.push('      - ' + quote(n)); });
        lines.push('', '# 默认先走 DIRECT（系统默认出口），确认后再在核心面板选择多线路均衡。',
            '# 不会把一条下载连接叠加成多条线路带宽；全部线路不可用时不保证自动回退。',
            '# 检测地址必须在正常联网时返回 204，不能用认证页面或普通 200 网页替代。',
            'rules:', '  - "MATCH,校园网出口"');
    } else if (mode === 'basic') {
        lines.push('', '# 基础直连：跟随当前系统出口。它不等于已开启全屋代理或多拨负载均衡。',
            'proxies: []', 'proxy-groups: []', 'rules:', '  - "MATCH,DIRECT"');
    } else throw new Error('请选择有效的参考配置类型。');
    return lines.join('\n') + '\n';
}

function gwifiReferenceDevices(interfaces, statusLines) {
    var rows = [], seen = {};
    var statusByIface = {};
    (statusLines || []).forEach(function(line) {
        if (line && line.iface) statusByIface[line.iface] = line;
    });
    uci.sections('gwifi', 'line', function(s) {
        if (s.enabled !== '1') return;
        var iface = s.iface || '';
        var line = statusByIface[iface] || {};
        var device = line.device || uci.get('network', iface, 'device') || uci.get('network', iface, 'ifname') || iface;
        var reason = '';
        if (s.TYPE === 'namespace') reason = '独立网络空间，普通核心不能直接使用';
        else if (typeof device !== 'string' || !/^[a-zA-Z0-9_.:-]{1,15}$/.test(device) || interfaces.indexOf(device) < 0)
            reason = '暂未找到对应的系统网卡';
        else if (seen[device]) reason = '与上面线路共用一张网卡，不重复加入';
        if (!reason) seen[device] = true;
        rows.push({ iface: iface, device: typeof device === 'string' ? device : '', reason: reason,
            online: line.status === 'online' ? '当前在线' : line.status === 'offline' ? '当前离线' : '状态未知' });
    });
    return rows;
}

function showGwifiIntro() {
    var key = 'gwifi.intro.dismissed.v1';
    try { if (window.localStorage.getItem(key) === '1') return; } catch (e) {}
    var skip = E('input', { type: 'checkbox', id: 'gwifi-intro-skip' });
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
            E('button', { class: 'btn cbi-button cbi-button-action', style: 'margin-top:14px', click: function(ev) {
                ev.preventDefault();
                if (skip.checked) {
                    try { window.localStorage.setItem(key, '1'); }
                    catch (e) { hint.textContent = '浏览器未能保存此选择；关闭后下次仍会显示说明。'; return; }
                }
                ui.hideModal();
            } }, '好的，我知道了')
        ])
    ]);
}

return view.extend({
    load: function() {
        return Promise.all([uci.load('gwifi'), uci.load('network'),
            fs.exec('/usr/bin/gwifi-get-interfaces').then(function(r) {
                if (r.code) throw new Error('无法读取网卡');
                var list = JSON.parse(r.stdout || '[]');
                if (!Array.isArray(list)) throw new Error('网卡信息格式不正确');
                return { interfaces: list };
            }).catch(function() { return { interfaces: [], failed: true }; }),
            fs.exec('/usr/bin/gwifi-status').then(function(r) {
                var lines = JSON.parse(r.stdout || '[]');
                return Array.isArray(lines) ? lines : [];
            }).catch(function() { return []; })]).then(function(data) {
                data[2].status = data[3];
                return data;
            });
    },
    render: function(data) {
        var info = data[2], entries = gwifiReferenceDevices(info.interfaces, info.status);
        var mode = E('select', { 'class': 'cbi-input-select', 'aria-label': '参考配置类型' }, [
            E('option', { value: 'basic' }, '基础直连（推荐先从这里开始）'),
            E('option', { value: 'multi' }, '多线路均衡示例（Mihomo）')
        ]);
        var health = E('input', { type: 'url', 'class': 'cbi-input-text',
            value: 'http://connect.rom.miui.com/generate_204', 'aria-label': '返回 204 的检测地址', style: 'width:100%;max-width:560px' });
        var checks = [];
        var chooser = E('div', {}, entries.map(function(row) {
            var id = 'gwifi-line-' + checks.length;
            var checkAttrs = { type: 'checkbox', id: id, 'aria-label': row.iface + ' 网卡 ' + row.device };
            if (row.reason) checkAttrs.disabled = 'disabled';
            var check = E('input', checkAttrs);
            checks.push({ input: check, device: row.device });
            var label = E('label', { 'for': id, style: 'display:flex;align-items:center;gap:10px;cursor:' + (row.reason ? 'not-allowed' : 'pointer') });
            label.appendChild(check);
            label.appendChild(E('span', {}, [E('strong', {}, row.iface), ' → ' + (row.device || '未知网卡')]));
            label.appendChild(E('span', { style: 'margin-left:auto;color:' + (row.online === '当前在线' ? '#16825d' : '#687782') }, row.reason || row.online));
            return E('div', { style: 'padding:10px 12px;border-bottom:1px solid #e4e9ec' }, [label]);
        }));
        var extra = E('div', { style: 'display:none;margin:12px 0;padding:16px;border:1px solid #d9e2e7;border-radius:6px;background:#f8fafb' }, [
            E('p', {}, '点选至少两张已认证、能独立联网的网卡。物理网口和虚拟网卡均可；同一网卡只加入一次。这里只列出已启用的认证线路，不主动探测或认证。'),
            info.failed ? E('p', {}, '读取网卡失败，请刷新重试；基础直连仍可生成。') :
                (!entries.length ? E('p', {}, '暂无已启用的认证线路，请先到认证设置中配置。') :
                    E('div', { style: 'border:1px solid #e4e9ec;border-radius:4px;background:#fff' }, [chooser])),
            E('label', {}, ['联网检测地址（正常联网时须返回 204）：', health]),
            E('p', {}, '默认检测地址仅作示例；若你的网络无法访问，请换成确认可用、返回 204 的地址。')
        ]);
        var output = E('textarea', { readonly: true, rows: 23, spellcheck: 'false',
            'aria-label': '生成的 YAML 参考配置', style: 'width:100%;font-family:monospace;white-space:pre;box-sizing:border-box' });
        var feedback = E('p', { role: 'status', 'aria-live': 'polite' });
        var copy = E('button', { 'class': 'btn cbi-button', disabled: true, click: function(ev) {
            ev.preventDefault();
            output.focus(); output.select();
            if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(output.value).then(function() { feedback.textContent = '已复制参考 YAML。'; })
                    .catch(function() { feedback.textContent = '浏览器未允许自动复制；内容已选中，请按 Ctrl+C 或长按复制。'; });
            } else {
                var ok = false;
                try { ok = document.execCommand('copy'); } catch (e) {}
                feedback.textContent = ok ? '已复制参考 YAML。' : '内容已选中，请按 Ctrl+C 或长按复制。';
            }
        } }, '复制 YAML');
        var download = E('button', { 'class': 'btn cbi-button', disabled: true, click: function(ev) {
            ev.preventDefault();
            var url;
            try {
                url = URL.createObjectURL(new Blob([output.value], { type: 'text/yaml;charset=utf-8' }));
                var a = E('a', { href: url, download: 'gwifi-mihomo-reference.yaml' });
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
                feedback.textContent = '已请求浏览器保存参考 YAML，请查看下载列表。';
            } catch (e) {
                if (url) URL.revokeObjectURL(url);
                feedback.textContent = '浏览器无法下载，请使用复制 YAML，保存为 .yaml 文件。';
            }
        } }, '下载 .yaml');
        function invalidate() {
            output.value = ''; copy.disabled = download.disabled = true;
            feedback.textContent = '选项已变化，请重新生成参考 YAML。';
        }
        mode.addEventListener('change', function() { extra.style.display = mode.value === 'multi' ? '' : 'none'; invalidate(); });
        health.addEventListener('input', invalidate);
        checks.forEach(function(c) { c.input.addEventListener('change', invalidate); });
        function generate() {
            try {
                output.value = gwifiReferenceYaml(mode.value, checks.filter(function(c) { return c.input.checked && !c.input.disabled; })
                    .map(function(c) { return c.device; }), health.value.trim());
                copy.disabled = download.disabled = false;
                feedback.textContent = '参考 YAML 已生成，未应用到路由器。';
            } catch (e) {
                output.value = ''; copy.disabled = download.disabled = true; feedback.textContent = e.message;
            }
        }
        var root = E('div', { 'class': 'cbi-map' }, [
            E('div', { style: 'padding:18px 20px;margin-bottom:16px;border-left:4px solid #2878a5;background:#f2f7fa' }, [
                E('div', { style: 'font-size:12px;color:#2878a5;font-weight:bold' }, 'MIHOMO · REFERENCE ONLY'),
                E('h2', { style: 'margin:6px 0' }, '生成 Mihomo 参考配置'),
                E('p', { style: 'margin:0' }, '示例不是机场订阅，不含校园网凭据，也不会写入配置或改变路由。多线路只按所选网卡分别发起连接，不会自动认证、替换 NAS 或叠加单次下载带宽。')
            ]),
            E('label', {}, ['配置类型：', mode]), extra,
            E('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0' }, [
                E('button', { 'class': 'btn cbi-button-action', click: function(ev) { ev.preventDefault(); generate(); } }, '生成参考 YAML'), copy, download
            ]), feedback, output,
            E('h3', {}, '拿到配置后怎么用？'),
            E('ol', {}, [
                E('li', {}, '先确认所选线路能独立上网，再备份原有 Clash 配置。'),
                E('li', {}, '用 Mihomo 的配置检查功能检查参考文件；没有添加代理服务器时，只能直连。'),
                E('li', {}, '示例只供本机端口测试，不会让家里所有设备自动走 Clash。若使用 OpenClash，需要另行设置接管方式、DNS 和校园网认证流量直连。'),
                E('li', {}, '多线路示例默认保留系统出口；确认后在核心面板切换到“多线路均衡”，并分别检查每条出口。不要直接覆盖正在工作的完整配置。')
            ]),
            E('p', {}, '字段依据 Mihomo 官方格式；示例尚未在此路由器上的 Mihomo 核心进行实际分流验证。使用 OpenClash 时还需单独设置接管方式及认证流量直连。')
        ]);
        generate();
        return root;
    },
    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});

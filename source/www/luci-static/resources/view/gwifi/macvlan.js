'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
    load: function() {
        return fs.exec('/usr/bin/gwifi-macvlan', ['list']).then(function(r) {
            try { return JSON.parse(r.stdout || '[]'); } catch(e) { return []; }
        }).then(function(macvlanList) {
            return fs.exec('/usr/bin/gwifi-get-interfaces').then(function(r) {
                try { return JSON.parse(r.stdout || '[]'); } catch(e) { return []; }
            }).then(function(interfaces) {
                return fs.exec('/usr/bin/gwifi-routing', ['list']).then(function(r) {
                    var routing = { auto_metric: 1, routing: [] };
                    try { routing = JSON.parse(r.stdout || '{"auto_metric":1,"routing":[]}'); } catch(e) {}
                    return { macvlanList: macvlanList, interfaces: interfaces, routingList: routing };
                });
            });
        });
    },
    render: function(data) {
        var self = this;
        var m = E('div', { class: 'cbi-map' });
        
        // ================= 1. 当前存在的虚拟网卡 =================
        var listHtml = E('div', { style: 'margin-top:20px;' }, [ E('h3', {}, '当前存在的虚拟网卡') ]);
        if (data.macvlanList.length === 0) {
            listHtml.appendChild(E('div', { style: 'padding:10px; color:#666;' }, '暂无虚拟网卡'));
        } else {
            data.macvlanList.forEach(function(item) {
                var devMode = item.mode || 'pure';
                if(devMode === 'pure') devMode = '纯净模式 (无伪装)';
                if(devMode === 'win') devMode = 'Windows (Intel MAC)';
                if(devMode === 'ipad') devMode = 'iPad (Apple MAC)';
                if(devMode === 'iphone') devMode = 'iPhone (Apple MAC)';
                if(devMode === 'android') devMode = 'Android (随机安卓MAC)';
                listHtml.appendChild(E('div', { style: 'display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border:1px solid #ddd; margin-bottom:5px; border-radius:4px; background:#fff;' }, [
                    E('div', {}, [
                        E('strong', { style: 'font-size:15px;' }, item.name),
                        E('span', { style: 'color:#666; margin-left:15px; font-size:13px;' }, 'IP: ' + (item.ip || '未获取') + ' | MAC: ' + (item.mac || '未知') + ' | 模拟: ' + devMode)
                    ]),
                    E('button', { class: 'btn cbi-button cbi-button-remove', click: function(ev) { ev.preventDefault(); self.doAction('macvlan', ['delete', item.name]); } }, '删除')
                ]));
            });
        }
        m.appendChild(listHtml);

        // ================= 2. 创建新虚拟网卡 =================
        var inputName = E('input', { type: 'text', id: 'new_vwan_name', placeholder: '名称 (如 vwan1)', style: 'padding:5px;' });
        
        var selectBase = E('select', { id: 'new_vwan_base', class: 'cbi-input-select', style: 'padding:5px;' });
        // 只保留有意义的物理接口，不让你看着一堆 dummy 和 erspan 烦心，同时绝对不丢 wan
        var baseIfaces = data.interfaces.filter(function(iface) {
            return iface === 'wan' || iface.indexOf('lan') === 0;
        });
        if (baseIfaces.length === 0) baseIfaces = ['wan', 'lan3']; // 保底
        
        baseIfaces.forEach(function(iface) {
            selectBase.appendChild(E('option', { value: iface }, iface));
        });

        // 原汁原味的设备选项，一个不少
        var selectDev = E('select', { id: 'new_vwan_dev', class: 'cbi-input-select', style: 'padding:5px;' }, [
            E('option', { value: 'pure' }, '纯净模式 (无伪装)'),
            E('option', { value: 'win' }, 'Windows (Intel MAC)'),
            E('option', { value: 'ipad' }, 'iPad (Apple MAC)'),
            E('option', { value: 'iphone' }, 'iPhone (Apple MAC)'),
            E('option', { value: 'android' }, 'Android (随机安卓MAC)')
        ]);

        var createHtml = E('div', { style: 'margin-top:20px; background:#f0f8ff; padding:15px; border-radius:4px;' }, [
            E('h3', {}, '➕ 创建新的虚拟网卡'),
            E('div', { style: 'display:flex; gap:10px; align-items:center;' }, [
                inputName, E('span', {}, '基于物理口:'), selectBase, E('span', {}, '模拟设备:'), selectDev,
                E('button', { class: 'btn cbi-button cbi-button-action', click: function(ev) {
                    ev.preventDefault();
                    var name = document.getElementById('new_vwan_name').value.trim();
                    var base = document.getElementById('new_vwan_base').value;
                    var dev = document.getElementById('new_vwan_dev').value;
                    if (!name) return alert('请输入网卡名称');
                    self.doAction('macvlan', ['create', name, base, dev]);
                } }, '创建')
            ]),
            E('div', { style: 'margin-top:10px; color:#d9534f; font-size:13px;' }, '⚠️ 提示：选择模拟设备后，后台会自动生成对应的真实厂商 MAC 地址和 DHCP 指纹。如果出现断网，请点击下方“一键修复所有策略路由”。')
        ]);
        m.appendChild(createHtml);

        // ================= 3. 网络主从优先级 (Metric) =================
        var isAuto = (data.routingList.auto_metric == 1);
        var isManual = (data.routingList.auto_metric == 0);
        var isAdv = (data.routingList.auto_metric == 2);

        var routeHtml = E('div', { style: 'margin-top:20px;' }, [
            E('h3', {}, '网络主从优先级 (Metric)'),
            E('div', { style: 'background:#f4f8fb; padding:15px; border-radius:4px; border:1px solid #d9edf7; margin-bottom:15px;' }, [
                E('div', { style: 'margin-bottom:10px; font-weight:bold; color:#31708f;' }, '⚙️ 主路由分配模式'),
                E('div', { style: 'display:flex; gap:10px; margin-bottom:10px;' }, [
                    E('button', { class: 'btn ' + (isAuto ? 'cbi-button-action' : 'cbi-button'), click: function(ev){ ev.preventDefault(); self.doAction('routing', ['set_auto', '1']); } }, '✓ 自动 (推荐)'),
                    E('button', { class: 'btn ' + (isManual ? 'cbi-button-action' : 'cbi-button'), click: function(ev){ ev.preventDefault(); self.doAction('routing', ['set_auto', '0']); } }, '切换为手动'),
                    E('button', { class: 'btn ' + (isAdv ? 'cbi-button-action' : 'cbi-button'), click: function(ev){ ev.preventDefault(); self.doAction('routing', ['set_auto', '2']); } }, '切换为高级')
                ]),
                E('div', { style: 'font-size:12px; color:#666;' }, '自动模式锁定按键防断网；手动模式可切换主路由；高级模式解锁下方自定义面板。')
            ])
        ]);

        // 如果处于高级模式，显示命令执行面板
        if (isAdv) {
            var advResult = E('pre', { style: 'background:#333; color:#fff; padding:10px; border-radius:4px; margin-top:10px; display:none; font-size:13px; overflow-x:auto;' });
            var advHtml = E('div', { style: 'background:#fff3cd; padding:15px; border-radius:4px; border:1px solid #ffeeba; margin-bottom:15px;' }, [
                E('div', { style: 'margin-bottom:10px; font-weight:bold; color:#856404;' }, '🛠️ 高级自定义命令'),
                E('div', { style: 'font-size:13px; color:#856404; margin-bottom:10px;' }, '当前处于高级模式，可直接执行系统命令（例如: ip route 或 uci show network）。请谨慎操作。'),
                E('div', { style: 'display:flex; gap:10px; align-items:center;' }, [
                    E('input', { type: 'text', id: 'gwifi_adv_cmd', placeholder: '输入需要执行的命令', style: 'flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;' }),
                    E('button', { class: 'btn cbi-button-action', click: function(ev) {
                        ev.preventDefault();
                        var cmd = document.getElementById('gwifi_adv_cmd').value;
                        if (!cmd) return;
                        advResult.style.display = 'block';
                        advResult.textContent = '正在执行，请稍候...';
                        fs.exec('/usr/bin/gwifi-routing', ['exec_custom', cmd]).then(function(r) {
                            advResult.textContent = r.stdout || r.stderr || '(无输出)';
                        });
                    } }, '执行命令')
                ]),
                advResult
            ]);
            routeHtml.appendChild(advHtml);
        }

        data.routingList.routing.forEach(function(item) {
            var isPrimary = (item.metric == '0');
            routeHtml.appendChild(E('div', { style: 'display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border:1px solid #ddd; margin-bottom:5px; border-radius:4px; background:#fff;' }, [
                E('div', {}, [
                    E('strong', { style: 'font-size:15px;' }, item.iface),
                    E('span', { style: 'color:#666; margin-left:15px;' }, 'IP: ' + item.ip),
                    E('span', { style: 'margin-left:15px; font-size:13px; color:' + (isPrimary ? '#5cb85c' : '#999') + ';' }, isPrimary ? '当前主路由 (Metric 0)' : '从路由 (Metric ' + item.metric + ')')
                ]),
                isPrimary ? E('span', { style: 'color:#5cb85c; font-weight:bold;' }, '✓ 主用') : E('button', { class: 'btn cbi-button', click: function(ev){ ev.preventDefault(); self.doAction('routing', ['set_primary', item.iface]); } }, '设为主路由')
            ]));
        });
        m.appendChild(routeHtml);

        // ================= 4. 一键修复策略路由 =================
        var repairHtml = E('div', { style: 'margin-top:20px; margin-bottom:30px;' }, [
            E('button', { class: 'btn cbi-button cbi-button-action', style: 'width:100%; padding:10px; font-size:14px;', click: function(ev) { 
                ev.preventDefault(); 
                ui.showModal('处理中', [ E('p', { class: 'spinning' }, '正在修复策略路由...') ]);
                fs.exec('/usr/bin/gwifi-routing', ['fix_routes']).then(function(r) {
                    ui.hideModal();
                    if (r.code === 0) {
                        ui.addNotification(null, E('p', {}, '策略路由修复成功'), 'info');
                        setTimeout(function() { location.reload(); }, 1000);
                    } else {
                        ui.addNotification(null, E('p', {}, '修复失败：' + (r.stderr || r.stdout)), 'danger');
                    }
                });
            } }, '▶ 一键修复所有策略路由')
        ]);
        m.appendChild(repairHtml);

        return m;
    },
    doAction: function(type, args) {
        var view = this;
        ui.showModal('处理中', [ E('p', { class: 'spinning' }, '正在执行操作...') ]);
        var script = type === 'macvlan' ? '/usr/bin/gwifi-macvlan' : '/usr/bin/gwifi-routing';
        fs.exec(script, args).then(function(r) {
            ui.hideModal();
            if (r.code === 0) {
                ui.addNotification(null, E('p', {}, '操作成功，页面即将刷新'), 'info');
                setTimeout(function() { location.reload(); }, 1000);
            } else {
                ui.addNotification(null, E('p', {}, '操作失败：' + (r.stderr || r.stdout)), 'danger');
            }
        });
    }
});

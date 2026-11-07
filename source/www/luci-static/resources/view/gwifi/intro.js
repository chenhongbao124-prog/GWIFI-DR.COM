'use strict';
'require view';
'require ui';

function showGwifiIntro() {
    var key = 'gwifi.intro.dismissed.v1';
    try { if (window.localStorage.getItem(key) === '1') return; } catch (e) {}
    var skip = E('input', { type: 'checkbox', id: 'gwifi-intro-skip' });
    var hint = E('small', { style: 'display:block;margin-top:8px;color:#65727a' }, '勾选后仅在本浏览器记住；未勾选时下次还会显示。');
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
            E('label', { 'for': 'gwifi-intro-skip', style: 'display:block;cursor:pointer' }, [skip, ' 以后不再弹出']),
            hint,
            E('button', { 'class': 'btn cbi-button cbi-button-action', style: 'margin-top:14px', click: function(ev) {
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
    load: function() { return Promise.resolve(); },
    render: function() {
        var root = E('div', { 'class': 'cbi-map' }, [
            E('div', { style: 'padding:24px;margin-bottom:20px;border-left:5px solid #16825d;background:#edf7f2;border-radius:4px' }, [
                E('div', { style: 'font-size:12px;color:#16825d;font-weight:bold' }, 'GWIFI · OPENWRT CAMPUS NETWORK'),
                E('h2', { style: 'margin:8px 0' }, '校园网认证与多线路管理'),
                E('p', { style: 'margin:0;max-width:900px' }, '集中管理校园网认证、虚拟网卡多拨、掉线重连、NAS 变化跟踪和 TTL 检查。基础认证独立工作；Clash 是可选的流量管理工具。')
            ]),
            E('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:20px' }, [
                E('div', { style: 'padding:15px;border:1px solid #dce5e8;border-top:3px solid #16825d;background:#fff' }, [E('strong', {}, '01 · 多线路'), E('p', { style: 'margin:6px 0 0;color:#53636c' }, '物理网口与虚拟网卡分别管理')]),
                E('div', { style: 'padding:15px;border:1px solid #dce5e8;border-top:3px solid #2878a5;background:#fff' }, [E('strong', {}, '02 · 自动维护'), E('p', { style: 'margin:6px 0 0;color:#53636c' }, '掉线检查、重连与 NAS 变化记录')]),
                E('div', { style: 'padding:15px;border:1px solid #dce5e8;border-top:3px solid #ca7b20;background:#fff' }, [E('strong', {}, '03 · TTL 检查'), E('p', { style: 'margin:6px 0 0;color:#53636c' }, '独立检查规则并在异常时提醒')])
            ]),
            E('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px' }, [
                E('section', { style: 'padding:16px;background:#f4f8fa;border:1px solid #dce5e8;border-radius:4px' }, [
                    E('h3', { style: 'margin-top:0' }, '适用范围'),
                    E('p', {}, '当前适配 gportal 网页认证流程（HTTP/AES），面向 Dr.COM 相关校园网场景。同样叫 Dr.COM，不同学校的登录入口和参数也可能不同，不能保证全部通用。')
                ]),
                E('section', { style: 'padding:16px;background:#fff8ee;border:1px solid #eadfcf;border-radius:4px' }, [
                    E('h3', { style: 'margin-top:0' }, '当前进度'),
                    E('p', {}, '基础功能已做本机和隔离环境验证；完整在线 NAS 迁移、不同固件适配及 Clash 联动仍需实测。因此目前属于已验证基础功能、仍在完善的版本。')
                ]),
                E('section', { style: 'padding:16px;background:#f1f7f9;border:1px solid #dce5e8;border-radius:4px' }, [
                    E('h3', { style: 'margin-top:0' }, 'Mihomo 参考配置'),
                    E('p', {}, '独立生成页位于“TTL 管理”后、“环境检测”前，不会自动安装、应用或改变路由。')
                ])
            ])
        ]);
        showGwifiIntro();
        return root;
    }
});

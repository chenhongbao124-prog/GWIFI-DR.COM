'use strict';
'require view';
'require fs';

return view.extend({
    timer: null,
    paused: false,
    currentTab: 'auth',

    load: function() { return Promise.resolve(); },

    render: function() {
        var view = this;

        var header = E('div', {
            style: 'margin-bottom:20px;border-bottom:2px solid #eee;padding-bottom:10px;display:flex;gap:20px;align-items:center;'
        }, [
            E('a', { href: L.env.scriptname + '/admin/services/gwifi', style: 'font-size:15px;color:#337ab7;text-decoration:none;' }, '⬅ 认证设置'),
            E('a', { href: L.env.scriptname + '/admin/services/gwifi/macvlan', style: 'font-size:15px;color:#337ab7;text-decoration:none;' }, '🔌 虚拟网卡'),
            E('strong', { style: 'font-size:18px;color:#333;' }, '📄 运行日志')
        ]);

        // 基础按钮样式
        var baseStyle = 'padding: 8px 20px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s;';
        // 激活时的按钮样式（蓝底白字）
        var activeStyle = 'padding: 8px 20px; margin-right: 10px; border: 1px solid #337ab7; border-radius: 4px; cursor: pointer; font-size: 14px; background: #337ab7; color: #fff; font-weight: bold; transition: all 0.2s;';

        var tabAuth = E('div', { id: 'tab_auth', style: activeStyle, click: function(e) { e.preventDefault(); view.switchTab('auth'); } }, '网络认证日志');
        var tabNet = E('div', { id: 'tab_net', style: baseStyle, click: function(e) { e.preventDefault(); view.switchTab('net'); } }, '虚拟网卡日志');
        var tabDetect = E('div', { id: 'tab_detect', style: baseStyle, click: function(e) { e.preventDefault(); view.switchTab('detect'); } }, '参数探测日志');
        
        var tabsContainer = E('div', { style: 'display:flex; margin-bottom:15px;' }, [tabAuth, tabNet, tabDetect]);

        var levelSel = E('select', { class: 'cbi-input-select', style: 'width:auto;' }, [
            E('option', { value: 'all' }, '全部级别'), E('option', { value: 'err' }, '仅错误 (err)'),
            E('option', { value: 'warning' }, '仅警告 (warning)'), E('option', { value: 'notice' }, '仅通知 (notice)')
        ]);
        var countSel = E('select', { class: 'cbi-input-select', style: 'width:auto;' }, [
            E('option', { value: '100' }, '最近 100 条'), E('option', { value: '200' }, '最近 200 条'),
            E('option', { value: '500' }, '最近 500 条'), E('option', { value: '0' }, '全部')
        ]);
        var refreshSel = E('select', { class: 'cbi-input-select', style: 'width:auto;' }, [
            E('option', { value: '1000' }, '1 秒刷新'), E('option', { value: '3000' }, '3 秒刷新'),
            E('option', { value: '5000' }, '5 秒刷新'), E('option', { value: '10000' }, '10 秒刷新'), E('option', { value: '0' }, '暂停刷新')
        ]);
        refreshSel.value = '3000';
        var keyword = E('input', { type: 'text', class: 'cbi-input-text', placeholder: '搜索关键字...', style: 'width:180px;' });
        var logPre = E('pre', { style: 'background:#1e1e1e;color:#4af626;padding:15px;border-radius:5px;overflow:auto;height:600px;font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;margin-top:15px;' }, '加载中...');

        var btnPause = E('button', { class: 'btn cbi-button cbi-button-reset' }, '⏸ 暂停');
        var btnManual = E('button', { class: 'btn cbi-button cbi-button-action' }, '↻ 立即刷新');
        var btnClear = E('button', { class: 'btn cbi-button cbi-button-reset' }, '🗑 清空显示');
        var statusText = E('span', { style: 'color:#999;font-size:12px;margin-left:10px;' }, '');

        var fetchLogs = function() {
            if (view.paused) return;
            var level = levelSel.value;
            var limit = parseInt(countSel.value, 10);
            var kw = (keyword.value || '').toLowerCase();
            
            var targetTag = 'gwifi:';
            if (view.currentTab === 'net') targetTag = 'gwifi-net:';
            if (view.currentTab === 'detect') targetTag = 'gwifi-detect:';

            fs.exec('/sbin/logread').then(function(r) {
                var text = (r && r.stdout) ? r.stdout : '';
                var lines = text.split('\n');
                var out = [];
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line.indexOf(targetTag) === -1) continue;
                    if (level !== 'all' && line.indexOf('.' + level) === -1) continue;
                    if (kw && line.toLowerCase().indexOf(kw) === -1) continue;
                    out.push(line);
                }
                if (limit > 0 && out.length > limit) out = out.slice(-limit);
                var rendered = out.length ? out.join('\n') : '（无匹配日志：当前缓冲区没有 ' + targetTag + ' 开头的行）';
                if (logPre.textContent !== rendered) {
                    logPre.textContent = rendered;
                    logPre.scrollTop = logPre.scrollHeight;
                }
                statusText.textContent = '最后刷新 ' + new Date().toLocaleTimeString() + ' / 显示 ' + out.length + ' 条';
            }).catch(function(err) {
                logPre.textContent = '日志读取失败：' + (err && err.message ? err.message : err) + '\n\n可能原因：rpcd 未运行、ACL 权限不足、或 logread 执行异常。';
                statusText.textContent = '读取失败 ' + new Date().toLocaleTimeString();
            });
        };

        var setTimer = function(ms) {
            if (view.timer) { clearInterval(view.timer); view.timer = null; }
            if (ms > 0 && !view.paused) view.timer = setInterval(fetchLogs, ms);
        };

        this.switchTab = function(tab) {
            view.currentTab = tab;
            
            // 动态切换样式
            tabAuth.style = (tab === 'auth') ? activeStyle : baseStyle;
            tabNet.style = (tab === 'net') ? activeStyle : baseStyle;
            tabDetect.style = (tab === 'detect') ? activeStyle : baseStyle;
            
            logPre.textContent = '加载中...';
            fetchLogs();
        };

        refreshSel.addEventListener('change', function() { view.paused = false; btnPause.textContent = '⏸ 暂停'; setTimer(parseInt(refreshSel.value, 10)); });
        levelSel.addEventListener('change', fetchLogs);
        countSel.addEventListener('change', fetchLogs);
        keyword.addEventListener('input', fetchLogs);
        btnPause.addEventListener('click', function() {
            view.paused = !view.paused;
            btnPause.textContent = view.paused ? '▶ 继续' : '⏸ 暂停';
            if (view.paused) { if (view.timer) { clearInterval(view.timer); view.timer = null; } }
            else { setTimer(parseInt(refreshSel.value, 10) || 3000); fetchLogs(); }
        });
        btnManual.addEventListener('click', fetchLogs);
        btnClear.addEventListener('click', function() { logPre.textContent = '（已清空显示，不影响系统日志）'; });

        setTimeout(function() { fetchLogs(); setTimer(3000); }, 100);

        return E('div', { class: 'cbi-map' }, [
            header, 
            tabsContainer, // 新的 Tabs 容器
            E('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:#f9f9f9;padding:12px;border-radius:5px;border:1px solid #ddd;' }, [
                E('span', { style: 'font-weight:bold;' }, '级别：'), levelSel,
                E('span', { style: 'font-weight:bold;' }, '条数：'), countSel,
                E('span', { style: 'font-weight:bold;' }, '刷新：'), refreshSel,
                keyword, btnManual, btnPause, btnClear, statusText
            ]),
            logPre
        ]);
    },
    handleSaveApply: null, handleSave: null, handleReset: null
});

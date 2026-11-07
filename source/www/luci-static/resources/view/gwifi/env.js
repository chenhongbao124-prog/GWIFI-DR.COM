'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
    load: function() {
        return fs.exec('/usr/bin/gwifi-dep-check').then(function(r) { 
            try { return JSON.parse(r.stdout); } catch(e) { return []; } 
        }).catch(function() { return []; });
    },
    render: function(deps) {
        var view = this;
        var m = E('div', { class: 'cbi-map' });

        var header = E('div', { style: 'margin-bottom: 20px;' }, [
            E('h2', {}, '🧩 环境依赖检测'),
            E('p', { style: 'color: #666;' }, '本插件依赖部分系统组件和内核模块。如果有标红的缺失项，请根据提示去安装，否则部分功能将不可用。')
        ]);
        m.appendChild(header);

        var container = E('div', { style: 'display:flex; flex-direction:column; gap:10px;' });
        
        deps.forEach(function(dep) {
            var isOk = dep.ok === 1;
            var icon = isOk ? '✅' : '❌';
            var color = isOk ? '#28a745' : '#dc3545';
            var bgColor = isOk ? '#f8f9fa' : '#f8d7da';
            var borderColor = isOk ? '#dee2e6' : '#f5c6cb';

            container.appendChild(E('div', { style: 'padding: 15px; background: ' + bgColor + '; border: 1px solid ' + borderColor + '; border-radius: 6px; display: flex; align-items: flex-start; gap: 15px;' }, [
                E('div', { style: 'font-size: 24px; line-height: 1;' }, icon),
                E('div', {}, [
                    E('div', { style: 'font-weight: bold; font-size: 16px; color: ' + color + '; margin-bottom: 5px;' }, dep.name),
                    E('div', { style: 'color: #333; font-size: 14px;' }, dep.desc)
                ])
            ]));
        });

        m.appendChild(container);

        // 如果有缺失项，给出一键复制的命令提示
        var hasMissing = deps.some(function(d) { return d.ok === 0; });
        if (hasMissing) {
            var pm=(deps.filter(function(d){return d.manager;})[0]||{}).manager;
            var packages=deps.filter(function(d){return d.ok===0&&d.package&&/^[a-z0-9+_.-]+$/.test(d.package);}).map(function(d){return d.package;}).filter(function(x,i,a){return a.indexOf(x)===i;});
            var installCmd=!packages.length?'请按缺失项说明检查对应组件和内核模块；无法可靠推断的项目不生成安装命令。':pm==='apk'?'apk update && apk add '+packages.join(' '):pm==='opkg'?'opkg update && opkg install '+packages.join(' '):'未检测到包管理器，无法生成命令。';
            m.appendChild(E('div', { style: 'margin-top: 20px; background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 4px;' }, [
                E('strong', {}, '⚠️ 缺失依赖修复建议：'),
                E('p', { style: 'margin: 5px 0;' }, '请在路由器后台（SSH或终端）执行以下命令安装缺失的组件：'),
                E('pre', { style: 'background:#333; color:#fff; padding:10px; border-radius:4px; user-select:all; cursor:pointer;' }, installCmd)
            ]));
        }

        return m;
    }
});

// ==UserScript==
// @name         米游社WIKI壁纸批量提取与下载助手
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  自动滚动页面并提取高清壁纸，无弹窗确认直接批量下载，支持关联页面原始标题命名，按分辨率（宽度）筛选过滤，专属署名版。
// @author       我思故汝永存
// @match        *://*.miyoushe.com/*
// @match        *://*.mihoyo.com/*
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 存储提取的对象：数组元素结构为 { url: 'xxx', title: 'xxx' }
    let extractedItems = [];
    let isScrolling = false;
    let isDownloading = false;
    let downloadQueue = [];
    let currentDownloadIndex = 0;

    // 清理文件名非法字符
    function sanitizeFilename(name) {
        if (!name) return "";
        return name.replace(/[\\/:*?"<>|]/g, "_").trim();
    }

    // 获取默认系列名称（提取网页标题前段）
    let defaultSeriesName = document.title.split('_')[0].split('-')[0].trim();
    defaultSeriesName = sanitizeFilename(defaultSeriesName) || "Miyoushe_Wallpaper";

    // 强制隔离的 CSS 样式
    const style = document.createElement('style');
    style.innerHTML = `
        #mys-helper-btn {
            position: fixed !important;
            right: 20px !important;
            bottom: 120px !important;
            z-index: 999999 !important;
            width: 50px !important;
            height: 50px !important;
            border-radius: 50% !important;
            background: #4a90e2 !important;
            color: white !important;
            border: none !important;
            cursor: pointer !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 22px !important;
            transition: all 0.3s ease !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        #mys-helper-btn:hover {
            transform: scale(1.1) !important;
            background: #357abd !important;
        }
        /* 强制重置面板及子元素，防止米游社全局样式污染 */
        #mys-helper-panel, #mys-helper-panel * {
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            text-align: left !important;
            text-transform: none !important;
            letter-spacing: normal !important;
        }
        #mys-helper-panel {
            position: fixed !important;
            right: 20px !important;
            bottom: 180px !important;
            z-index: 999999 !important;
            width: 330px !important;
            background: #1c1c1e !important;
            color: #f2f2f7 !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
            display: none;
            flex-direction: column !important;
            overflow: hidden !important;
            border: 1px solid #3a3a3c !important;
        }
        #mys-helper-panel .mys-header {
            background: #2c2c2e !important;
            padding: 12px 16px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-bottom: 1px solid #3a3a3c !important;
            height: auto !important;
        }
        #mys-helper-panel .mys-title-text {
            font-weight: bold !important;
            font-size: 14px !important;
            color: #ffffff !important;
        }
        #mys-helper-panel .mys-close {
            cursor: pointer !important;
            color: #aeaeb2 !important;
            font-size: 16px !important;
            background: none !important;
            border: none !important;
        }
        #mys-helper-panel .mys-close:hover {
            color: #f2f2f7 !important;
        }
        #mys-helper-panel .mys-body {
            padding: 16px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
        }
        #mys-helper-panel .mys-input-group {
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
        }
        #mys-helper-panel .mys-label {
            font-size: 12px !important;
            color: #aeaeb2 !important;
            font-weight: 500 !important;
        }
        #mys-helper-panel .mys-input {
            background: #2c2c2e !important;
            border: 1px solid #3a3a3c !important;
            color: #ffffff !important;
            padding: 6px 10px !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            outline: none !important;
            width: 100% !important;
            height: 32px !important;
        }
        #mys-helper-panel .mys-input:focus {
            border-color: #0a84ff !important;
        }
        #mys-helper-panel .mys-radio-group {
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            background: #2c2c2e !important;
            padding: 10px !important;
            border-radius: 8px !important;
            border: 1px solid #3a3a3c !important;
        }
        #mys-helper-panel .mys-status {
            background: #2c2c2e !important;
            padding: 8px 12px !important;
            border-radius: 6px !important;
            font-size: 12px !important;
            color: #30d158 !important;
            min-height: 38px !important;
            display: flex !important;
            align-items: center !important;
            word-break: break-all !important;
        }
        #mys-helper-panel .mys-btn {
            background: #34c759 !important;
            color: white !important;
            border: none !important;
            padding: 10px !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            transition: background 0.2s !important;
            text-align: center !important;
            width: 100% !important;
            display: block !important;
            height: 38px !important;
        }
        #mys-helper-panel .mys-btn:hover {
            background: #28a745 !important;
        }
        #mys-helper-panel .mys-btn:disabled {
            background: #3a3a3c !important;
            color: #8e8e93 !important;
            cursor: not-allowed !important;
        }
        #mys-helper-panel .mys-btn-secondary {
            background: #0a84ff !important;
        }
        #mys-helper-panel .mys-btn-secondary:hover {
            background: #0066cc !important;
        }
        #mys-helper-panel .mys-links-container {
            max-height: 100px !important;
            overflow-y: auto !important;
            background: #000000 !important;
            border-radius: 6px !important;
            padding: 8px !important;
            display: none !important;
            font-size: 11px !important;
            font-family: monospace !important;
            white-space: pre !important;
            border: 1px solid #2c2c2e !important;
            color: #30d158 !important;
        }
        #mys-helper-panel .mys-footer {
            padding: 10px 16px !important;
            background: #1c1c1e !important;
            border-top: 1px solid #2c2c2e !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            align-items: flex-start !important;
        }
        #mys-helper-panel .mys-checkbox-container {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            font-size: 12px !important;
            cursor: pointer !important;
            user-select: none !important;
        }
        #mys-helper-panel .mys-checkbox-container input {
            margin: 0 !important;
            width: 14px !important;
            height: 14px !important;
        }
        /* 专属署名样式 */
        #mys-helper-panel .mys-attribution {
            font-size: 10px !important;
            color: #8e8e93 !important;
            width: 100% !important;
            text-align: right !important;
            border-top: 1px dashed #2c2c2e !important;
            padding-top: 6px !important;
            user-select: none !important;
        }
        #mys-helper-panel .mys-attribution a {
            color: #ff2d55 !important;
            text-decoration: none !important;
            font-weight: bold !important;
            font-size: 10px !important;
            transition: color 0.2s ease !important;
            display: inline !important;
        }
        #mys-helper-panel .mys-attribution a:hover {
            text-decoration: underline !important;
            color: #ff3b30 !important;
        }
    `;
    document.head.appendChild(style);

    // 创建UI元素
    const floatBtn = document.createElement('button');
    floatBtn.id = 'mys-helper-btn';
    floatBtn.innerText = '📥';
    floatBtn.title = '米游社壁纸提取助手';
    document.body.appendChild(floatBtn);

    const panel = document.createElement('div');
    panel.id = 'mys-helper-panel';
    panel.innerHTML = `
        <div class="mys-header">
            <span class="mys-title-text">米游社壁纸提取助手</span>
            <span class="mys-close" id="mys-panel-close">✕</span>
        </div>
        <div class="mys-body">
            <div class="mys-input-group">
                <span class="mys-label">命名规则</span>
                <div class="mys-radio-group">
                    <label class="mys-checkbox-container">
                        <input type="radio" name="mys-naming-rule" value="original" checked> 优先使用原始标题 (推荐)
                    </label>
                    <label class="mys-checkbox-container">
                        <input type="radio" name="mys-naming-rule" value="series"> 统一系列命名 (系列_0x)
                    </label>
                </div>
            </div>
            <div class="mys-input-group" id="mys-series-input-wrapper" style="display:none;">
                <span class="mys-label">系列名称设定</span>
                <input type="text" id="mys-input-series" class="mys-input" value="${defaultSeriesName}">
            </div>
            <div class="mys-input-group">
                <span class="mys-label">过滤最小宽度限制 (px, 0表示不限制)</span>
                <input type="number" id="mys-input-minwidth" class="mys-input" value="1000" min="0" step="100">
            </div>
            <div class="mys-status" id="mys-status-text">状态：等待操作...</div>
            <button class="mys-btn" id="mys-btn-extract">🚀 开始提取（自动滚动）</button>
            <button class="mys-btn mys-btn-secondary" id="mys-btn-copy" disabled>📋 复制链接列表</button>
            <button class="mys-btn mys-btn-secondary" id="mys-btn-download" disabled>💾 一键批量下载</button>
            <div class="mys-links-container" id="mys-links-preview"></div>
        </div>
        <div class="mys-footer">
            <label class="mys-checkbox-container">
                <input type="checkbox" id="mys-auto-check"> 载入页面后自动提取
            </label>
            <div class="mys-attribution">
                power by gmini, Made with ❤️ by 
                <a href="https://space.bilibili.com/651921014?spm_id_from=333.1007.0.0" target="_blank" title="访问我的 Bilibili 空间">我思故汝永存</a>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // 获取DOM元素引用
    const statusText = document.getElementById('mys-status-text');
    const btnExtract = document.getElementById('mys-btn-extract');
    const btnCopy = document.getElementById('mys-btn-copy');
    const btnDownload = document.getElementById('mys-btn-download');
    const linksPreview = document.getElementById('mys-links-preview');
    const autoCheck = document.getElementById('mys-auto-check');
    const panelClose = document.getElementById('mys-panel-close');
    const inputSeries = document.getElementById('mys-input-series');
    const seriesInputWrapper = document.getElementById('mys-series-input-wrapper');
    const inputMinWidth = document.getElementById('mys-input-minwidth');
    const namingRules = document.getElementsByName('mys-naming-rule');

    // 读取并设置自动提取的偏好
    const autoExtractKey = 'mys_wallpaper_auto_extract';
    let autoExtractEnabled = localStorage.getItem(autoExtractKey) === 'true';
    autoCheck.checked = autoExtractEnabled;

    autoCheck.addEventListener('change', (e) => {
        localStorage.setItem(autoExtractKey, e.target.checked);
        updateStatus(`偏好设置已更新：${e.target.checked ? "开启自动提取" : "关闭自动提取"}`);
    });

    // 监听命名规则切换事件，显示/隐藏系列名称输入框
    namingRules.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'series') {
                seriesInputWrapper.style.display = 'flex';
            } else {
                seriesInputWrapper.style.display = 'none';
            }
        });
    });

    // 切换面板显示/隐藏
    floatBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
    });

    panelClose.addEventListener('click', () => {
        panel.style.display = 'none';
    });

    // 更新状态文本
    function updateStatus(text, isError = false) {
        statusText.innerText = text;
        statusText.style.color = isError ? '#ff453a' : '#30d158';
    }

    // 模拟自动滚动，确保图片加载
    async function autoScroll() {
        return new Promise((resolve) => {
            let totalHeight = 0;
            let distance = window.innerHeight * 0.8;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0); // 回滚到顶部
                    resolve();
                }
            }, 100);
        });
    }

    // 智能定位最邻近标题算法 (DOM层级树匹配)
    function findNearestCaption(el) {
        // 1. 如果是 img 标签，先检测 alt 或 title 属性
        if (el.tagName === 'IMG') {
            let alt = el.getAttribute('alt') || el.getAttribute('title');
            if (alt && alt.trim().length > 2 && alt.trim().length < 80) {
                return alt.trim();
            }
        }

        // 2. 逐级向上检索容器树（最多往上找 4 层），解析容器内的短文本块
        let curr = el;
        for (let i = 0; i < 4; i++) {
            if (!curr) break;
            let text = curr.innerText || '';
            // 去除多余空白与换行
            text = text.replace(/\s+/g, ' ').trim();
            // 在卡片级节点中，壁纸标题一般控制在 2 ~ 60 个字符以内
            if (text.length > 2 && text.length < 60) {
                return text;
            }
            curr = curr.parentElement;
        }
        return '';
    }

    // 异步检测单张图片分辨率
    function checkImageResolution(url) {
        return new Promise((resolve) => {
            const img = new Image();
            const timer = setTimeout(() => {
                img.src = '';
                resolve({ width: 0, height: 0 });
            }, 5000); // 5秒超时保护

            img.onload = () => {
                clearTimeout(timer);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                clearTimeout(timer);
                resolve({ width: 0, height: 0 });
            };
            img.src = url;
        });
    }

    // 批量异步过滤分辨率
    async function filterItemsByResolution(items, minWidth) {
        if (minWidth <= 0) return items;

        const filtered = [];
        let checkedCount = 0;
        const total = items.length;
        const chunkSize = 5;

        for (let i = 0; i < total; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const results = await Promise.all(chunk.map(async (item) => {
                const dims = await checkImageResolution(item.url);
                return { item, dims };
            }));

            results.forEach(res => {
                if (res.dims.width >= minWidth) {
                    filtered.push(res.item);
                }
            });

            checkedCount += chunk.length;
            updateStatus(`🔍 正在过滤低分辨率资源 (${checkedCount}/${total})...`);
        }
        return filtered;
    }

    // 主提取清洗逻辑
    function performExtraction() {
        const itemsMap = new Map(); // url -> title, 避免重复提取
        const excludeKeywords = [
            'avatar', 'emotion', 'emoji', 'icon', 'badge', 'level',
            'relic', 'logo', 'css', 'game_record', 'sys_role',
            'sign-in', 'qrcode', 'head', 'common', 'ui', 'sprite'
        ];

        // 验证 URL 是否合理
        function isValidImg(url) {
            if (!url.includes('mihoyo.com') && !url.includes('miyoushe.com') && !url.includes('aliyuncs.com')) {
                return false;
            }
            let cleanUrl = url.split('?')[0];
            const isNoise = excludeKeywords.some(keyword => cleanUrl.toLowerCase().includes(keyword));
            if (isNoise) return false;

            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
            return validExtensions.some(ext => cleanUrl.toLowerCase().endsWith(ext));
        }

        // 提取 img 元素
        document.querySelectorAll('img').forEach(img => {
            let src = img.getAttribute('data-src') || img.getAttribute('src') || img.src;
            if (src && isValidImg(src)) {
                let cleanUrl = src.startsWith('//') ? 'https:' + src : src;
                cleanUrl = cleanUrl.split('?')[0]; // 去除缩略图参数，恢复高清无损

                let caption = findNearestCaption(img);
                if (!itemsMap.has(cleanUrl) || (!itemsMap.get(cleanUrl) && caption)) {
                    itemsMap.set(cleanUrl, caption);
                }
            }
        });

        // 提取背景图片元素
        document.querySelectorAll('*').forEach(el => {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
                const match = bg.match(/url\(['"]?(https?:\/\/[^'"]+)['"]?\)/);
                if (match && isValidImg(match[1])) {
                    let cleanUrl = match[1].startsWith('//') ? 'https:' + match[1] : match[1];
                    cleanUrl = cleanUrl.split('?')[0];

                    let caption = findNearestCaption(el);
                    if (!itemsMap.has(cleanUrl) || (!itemsMap.get(cleanUrl) && caption)) {
                        itemsMap.set(cleanUrl, caption);
                    }
                }
            }
        });

        // 转换为对象数组
        const items = [];
        itemsMap.forEach((title, url) => {
            items.push({ url, title });
        });
        return items;
    }

    // 主工作流
    async function startExtract() {
        if (isScrolling) return;
        isScrolling = true;
        btnExtract.disabled = true;
        updateStatus("正在模拟自动滚动，加载懒加载图片...");

        await autoScroll();

        updateStatus("搜集原始链接并解析邻近标题...");
        const rawItems = performExtraction();

        const minWidth = parseInt(inputMinWidth.value) || 0;
        updateStatus(`正在筛选分辨率 (目标宽度 >= ${minWidth}px)...`);

        extractedItems = await filterItemsByResolution(rawItems, minWidth);

        isScrolling = false;
        btnExtract.disabled = false;

        if (extractedItems.length > 0) {
            updateStatus(`✨ 提取成功！共筛选出 ${extractedItems.length} 张高清壁纸。`);
            btnCopy.disabled = false;
            btnDownload.disabled = false;

            // 在控制台预览显示提取结果
            linksPreview.style.display = 'block';
            linksPreview.innerText = extractedItems.map(item => {
                return `[${item.title || "未知标题"}] -> ${item.url}`;
            }).join('\n');
        } else {
            updateStatus(`未检测到大于 ${minWidth}px 的壁纸，请微调过滤规则后重试。`, true);
            btnCopy.disabled = true;
            btnDownload.disabled = true;
            linksPreview.style.display = 'none';
        }
    }

    // 绑定事件
    btnExtract.addEventListener('click', startExtract);

    // 复制纯链接
    btnCopy.addEventListener('click', () => {
        if (extractedItems.length === 0) return;
        const text = extractedItems.map(item => item.url).join('\n');
        GM_setClipboard(text);
        updateStatus(`已成功将 ${extractedItems.length} 条链接复制到剪切板！`);
        GM_notification({
            title: "米游社壁纸提取",
            text: "无水印纯链接已保存在剪切板，可直接导入IDM等工具。",
            timeout: 3000
        });
    });

    // 队列式批量下载核心
    function processDownloadQueue(useOriginalTitle, seriesName) {
        if (currentDownloadIndex >= downloadQueue.length) {
            isDownloading = false;
            btnDownload.disabled = false;
            btnDownload.innerText = "💾 一键批量下载";
            updateStatus(`✨ 批量下载完成！共成功下载 ${downloadQueue.length} 张。`);
            GM_notification({
                title: "下载完成",
                text: "壁纸已成功下载至您的浏览器默认下载目录中！",
                timeout: 3000
            });
            return;
        }

        const item = downloadQueue[currentDownloadIndex];
        let ext = item.url.split('.').pop().split('?')[0] || 'png';
        if (ext.length > 4) ext = 'png';

        // 确定保存的文件名
        let finalName = "";
        if (useOriginalTitle && item.title) {
            // 使用原始抓取标题
            finalName = sanitizeFilename(item.title);
        } else {
            // 使用系列序列号命名
            const serialNum = String(currentDownloadIndex + 1).padStart(2, '0');
            finalName = `${seriesName}_${serialNum}`;
        }

        // 重名自适应防御
        if (nameTracker[finalName]) {
            nameTracker[finalName]++;
            finalName = `${finalName}_${nameTracker[finalName]}`;
        } else {
            nameTracker[finalName] = 1;
        }

        const filepath = `Miyoushe_Wiki_Wallpapers/${finalName}.${ext}`;

        updateStatus(`正在下载: (${currentDownloadIndex + 1}/${downloadQueue.length})`);
        btnDownload.innerText = `正在下载 ${currentDownloadIndex + 1}/${downloadQueue.length}`;

        GM_download({
            url: item.url,
            name: filepath,
            onload: () => {
                currentDownloadIndex++;
                setTimeout(() => processDownloadQueue(useOriginalTitle, seriesName), 150);
            },
            onerror: (err) => {
                console.error(`下载失败: ${item.url}`, err);
                currentDownloadIndex++;
                setTimeout(() => processDownloadQueue(useOriginalTitle, seriesName), 150);
            }
        });
    }

    // 全局防同名计数器
    let nameTracker = {};

    // 批量下载按钮事件
    btnDownload.addEventListener('click', () => {
        if (extractedItems.length === 0 || isDownloading) return;

        const useOriginalTitle = document.querySelector('input[name="mys-naming-rule"]:checked').value === 'original';
        const seriesName = sanitizeFilename(inputSeries.value) || "Wallpaper";

        // 已移除浏览器弹出提示框，直接进入静默队列下载
        isDownloading = true;
        btnDownload.disabled = true;
        downloadQueue = [...extractedItems];
        currentDownloadIndex = 0;
        nameTracker = {}; // 重置防同名计数器
        processDownloadQueue(useOriginalTitle, seriesName);
    });

    // 自动执行检测
    if (autoExtractEnabled) {
        setTimeout(() => {
            panel.style.display = 'flex';
            startExtract();
        }, 2000);
    }
})();

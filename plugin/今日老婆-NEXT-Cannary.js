// ==UserScript==
// @name         今日老婆
// @author       是非，艾因，群友
// @version      1.2.3
// @description  修复缓存读取导致的 URL 拼接错误
// @timestamp    20240520
// @license      Apache-2
// ==/UserScript==

/**
 * 核心扩展对象初始化
 */
let ext = seal.ext.find('今日老婆');
if (!ext) {
    ext = seal.ext.new('今日老婆', '群友，艾因，是非', '1.2.3');
    seal.ext.register(ext);

    // 注册配置项
    seal.ext.registerBoolConfig(ext, 'debug', false, '调试模式 【报告问题前必须启用】');
    seal.ext.registerBoolConfig(ext, 'useSealCode', false, '使用海豹码代替CQ码 不懂别开');
    seal.ext.registerBoolConfig(ext, 'useBase64CQ', false, '使用 base64:// CQ Code 不懂别开');
    seal.ext.registerBoolConfig(ext, 'noFormat', false, '不执行 format 不懂别开')
    seal.ext.registerStringConfig(ext, "api_url", "http://localhost:18428", "jrlp 后端地址 [ 结尾有无 / 均可 ]");
    seal.ext.registerIntConfig(ext, "daily_hlp_limit", 5, "每天最多换老婆次数");
    seal.ext.registerIntConfig(ext, "retry_times", 3, "API失败重试次数");
    seal.ext.registerIntConfig(ext, "retry_interval", 10, "重试间隔(ms)");

    const getCleanApiUrl = () => {
        let url = seal.ext.getStringConfig(ext, "api_url").trim();
        return url.replace(/\/+$/, "");
    };

    const logDebug = (info) => {
        if (seal.ext.getBoolConfig(ext, 'debug')) {
            console.log(`[jrlp-DEBUG] ${info}`);
        }
    };

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    async function fetchWithRetry(url) {
        const times = seal.ext.getIntConfig(ext, "retry_times");
        const interval = seal.ext.getIntConfig(ext, "retry_interval");

        for (let i = 0; i <= times; i++) {
            try {
                const res = await fetch(url);
                if (res.ok) return res;
                logDebug(`请求失败 ${res.status}，重试 ${i}/${times}`);
            } catch (e) {
                logDebug(`网络异常，重试 ${i}/${times}: ${e.message}`);
            }
            if (i < times) await sleep(interval);
        }
        return null;
    }

    const validateConfig = (ctx, msg) => {
        const useSeal = seal.ext.getBoolConfig(ext, 'useSealCode');
        const useB64 = seal.ext.getBoolConfig(ext, 'useBase64CQ');
        if (useSeal && useB64) {
            seal.replyToSender(ctx, msg, "【插件配置错误】不能同时启用 useSealCode 和 useBase64CQ，请联系管理员修改插件配置。");
            return false;
        }
        return true;
    };

    const dailyReset = (ctx) => {
        const currentDay = seal.vars.intGet(ctx, `$tDay`)[0];
        const lastUpdatedDay = parseInt(seal.vars.strGet(ctx, `$m时间变量`)[0]) || 0;

        if (currentDay !== lastUpdatedDay) {
            logDebug(`日期变更，重置次数`);
            seal.vars.strSet(ctx, `$m时间变量`, String(currentDay));
            seal.vars.strSet(ctx, `$m今日老婆次数`, "0");
        }
    };

    async function getCharacterData() {
        const apiUrl = `${getCleanApiUrl()}/api/character`;
        logDebug(`请求API: ${apiUrl}`);

        const response = await fetchWithRetry(apiUrl);
        if (!response) {
            console.error(`[jrlp-ERROR] API 请求最终失败`);
            return null;
        }

        try {
            return await response.json();
        } catch (e) {
            logDebug(`JSON解析失败: ${e.message}`);
            return null;
        }
    }

    const formatWifeResponse = (ctx, data, suffix = "") => {
        if (!data || (!data.image_sub && !data.image_base64)) return "获取老婆数据失败，数据字段缺失";

        const useSeal = seal.ext.getBoolConfig(ext, 'useSealCode');
        const useB64 = seal.ext.getBoolConfig(ext, 'useBase64CQ');
        const noFormat = seal.ext.getBoolConfig(ext, 'noFormat');
        const baseUrl = getCleanApiUrl();

        let imgPart;
        // 确保 sub 路径以 / 开头
        const subPath = data.image_sub && !data.image_sub.startsWith('/') ? `/${data.image_sub}` : (data.image_sub || "");

        if (useSeal) {
            imgPart = `[图:${baseUrl}${subPath}]`;
        } else if (useB64 && data.image_base64) {
            imgPart = `[CQ:image,file=base64://${data.image_base64}]`;
        } else {
            imgPart = `[CQ:image,file=${baseUrl}${subPath}]`;
        }

        const name = data.filename || "神秘角色";
        const content = `${imgPart}\n{$t玩家}今天的老婆是${name}${suffix}`;

        return noFormat ? content : seal.format(ctx, content);
    };

    const handleWifeRequest = async (ctx, msg, isHlp) => {
        dailyReset(ctx);
        if (!validateConfig(ctx, msg)) return;

        const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
        const limit = seal.ext.getIntConfig(ext, "daily_hlp_limit");

        const getCachedData = () => {
            const sub = seal.vars.strGet(ctx, `$m今日老婆sub`)[0];
            const name = seal.vars.strGet(ctx, `$m老婆名字`)[0];
            // 如果缓存的关键路径为空，强制返回 null 触发重新请求
            if (!sub && !isHlp) return null;
            return {
                image_sub: sub,
                image_base64: seal.vars.strGet(ctx, `$m今日老婆b64`)[0],
                filename: name
            };
        };

        // jrlp 逻辑：如果有次数则读缓存
        if (!isHlp && todayCount > 0) {
            const oldData = getCachedData();
            if (oldData) {
                seal.replyToSender(ctx, msg, formatWifeResponse(ctx, oldData));
                return;
            }
            // 如果缓存损坏，则向下执行重新获取（不消耗次数，因为是修复行为）
        }

        // hlp 逻辑：检查上限
        if (isHlp && todayCount >= limit) {
            const oldData = getCachedData();
            const suffix = `\n(每天最多换 ${limit} 次老婆哦)`;
            seal.replyToSender(ctx, msg, formatWifeResponse(ctx, oldData, suffix));
            return;
        }

        // 发起网络请求
        const data = await getCharacterData();
        if (!data) {
            seal.replyToSender(ctx, msg, "获取老婆失败，后端暂时不可用。");
            return;
        }

        seal.vars.strSet(ctx, `$m今日老婆sub`, data.image_sub || "");
        seal.vars.strSet(ctx, `$m今日老婆b64`, data.image_base64 || "");
        seal.vars.strSet(ctx, `$m老婆名字`, data.filename || "");
        seal.vars.strSet(ctx, `$m今日老婆次数`, String(todayCount + 1));

        seal.replyToSender(ctx, msg, formatWifeResponse(ctx, data));
    };

    const cmdjrlp = seal.ext.newCmdItemInfo();
    cmdjrlp.name = 'jrlp';
    cmdjrlp.help = '.jrlp 查看今日老婆\n.jrlp status 查看后端状态';
    cmdjrlp.solve = async (ctx, msg, cmdArgs) => {
        if (cmdArgs.getArgN(1) === 'status') {
            const apiUrl = `${getCleanApiUrl()}/status`;
            const res = await fetchWithRetry(apiUrl);
            if (!res) {
                seal.replyToSender(ctx, msg, "无法连接到后端服务");
                return seal.ext.newCmdExecuteResult(true);
            }
            try {
                const d = await res.json();
                seal.replyToSender(ctx, msg, `API 状态: ${d.service_availability}\nCPU: ${d.system_metrics.cpu_usage_percent}%\nRAM: ${d.system_metrics.memory_usage.used_gb}/${d.system_metrics.memory_usage.total_gb} (${d.system_metrics.memory_usage['percent']}%)\nImgNum: ${d.image_statistics.total_count}`);
            } catch (e) { seal.replyToSender(ctx, msg, "解析后端响应失败"); }
            return seal.ext.newCmdExecuteResult(true);
        }
        await handleWifeRequest(ctx, msg, false);
        return seal.ext.newCmdExecuteResult(true);
    };

    const cmdhlp = seal.ext.newCmdItemInfo();
    cmdhlp.name = 'hlp';
    cmdhlp.solve = async (ctx, msg) => {
        const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
        if (todayCount === 0) {
            seal.replyToSender(ctx, msg, "你还没有今日老婆哦");
        } else {
            await handleWifeRequest(ctx, msg, true);
        }
        return seal.ext.newCmdExecuteResult(true);
    };

    ext.cmdMap['jrlp'] = cmdjrlp;
    ext.cmdMap['今日老婆'] = cmdjrlp;
    ext.cmdMap['hlp'] = cmdhlp;
    ext.cmdMap['换老婆'] = cmdhlp;

    ext.onNotCommandReceived = async (ctx, msg) => {
        const text = msg.message.replace(/\[CQ:at,qq=.*?]\s*/, '').trim();
        if (['jrlp', '今日老婆'].includes(text)) {
            await handleWifeRequest(ctx, msg, false);
        } else if (['hlp', '换老婆'].includes(text)) {
            const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
            if (todayCount > 0) await handleWifeRequest(ctx, msg, true);
        }
    };
}
// ==UserScript==
// @name         今日老婆
// @author       是非，艾因，群友
// @version      1.2.0
// @description  重构版：jrlp获取今日老婆，hlp换一个老婆（有次数限制）。修复配置冲突并增强Debug。
// @timestamp    20240520
// @license      Apache-2
// ==/UserScript==

/**
 * 核心扩展对象初始化
 */
let ext = seal.ext.find('今日老婆');
if (!ext) {
    ext = seal.ext.new('今日老婆', '群友，艾因，是非', '1.2.0');
    seal.ext.register(ext);

    // 注册配置项
    seal.ext.registerBoolConfig(ext, 'debug', false, '调试模式 【报告问题前必须启用】');
    seal.ext.registerBoolConfig(ext, 'useSealCode', false, '使用海豹码代替CQ码 不懂别开');
    seal.ext.registerBoolConfig(ext, 'useBase64CQ', false, '使用 base64:// CQ Code 不懂别开');
    seal.ext.registerStringConfig(ext, "api_url", "http://localhost:18428", "jrlp 后端地址 [ 必须以 http(s):// 开头，且结尾不能有 / ]");
    seal.ext.registerIntConfig(ext, "daily_hlp_limit", 5, "每天最多换老婆次数");

    /**
     * 内部辅助：调试日志
     * @param {string} info - 日志内容
     */
    const logDebug = (info) => {
        if (seal.ext.getBoolConfig(ext, 'debug')) {
            console.log(`[jrlp-DEBUG] ${info}`);
        }
    };

    /**
     * 内部辅助：配置冲突预检
     * @param {seal.MsgContext} ctx
     * @param {seal.Message} msg
     * @returns {boolean} 是否通过校验
     */
    const validateConfig = (ctx, msg) => {
        const useSeal = seal.ext.getBoolConfig(ext, 'useSealCode');
        const useB64 = seal.ext.getBoolConfig(ext, 'useBase64CQ');
        if (useSeal && useB64) {
            seal.replyToSender(ctx, msg, "【插件配置错误】不能同时启用 useSealCode 和 useBase64CQ，请联系管理员修改插件配置。");
            return false;
        }
        return true;
    };

    /**
     * 每日数据重置
     * @param {seal.MsgContext} ctx
     */
    const dailyReset = (ctx) => {
        const currentDay = seal.vars.intGet(ctx, `$tDay`)[0];
        const lastUpdatedDay = parseInt(seal.vars.strGet(ctx, `$m时间变量`)[0]) || 0;

        if (currentDay !== lastUpdatedDay) {
            logDebug(`检测到日期变更: ${lastUpdatedDay} -> ${currentDay}, 执行重置`);
            seal.vars.strSet(ctx, `$m时间变量`, String(currentDay));
            seal.vars.strSet(ctx, `$m今日老婆次数`, "0");
        }
    };

    /**
     * 调用后端 API 获取数据
     * @returns {Promise<Object>}
     */
    async function getCharacterData() {
        const apiUrl = `${seal.ext.getStringConfig(ext, "api_url")}/api/character`;
        logDebug(`正在请求 API: ${apiUrl}`);

        const response = await fetch(apiUrl);
        if (!response.ok) console.error(`API 请求失败: HTTP ${response.status}`);
        const data = await response.json();
        logDebug(`API 响应成功: 获取到角色 [${data.filename}]`);
        return data;
    }

    /**
     * 渲染回复文本
     * @param {seal.MsgContext} ctx
     * @param {Object} data - 包含 url, b64, filename
     * @param {string} suffix - 额外说明后缀
     */
    const formatWifeResponse = (ctx, data, suffix = "") => {
        const useSeal = seal.ext.getBoolConfig(ext, 'useSealCode');
        const useB64 = seal.ext.getBoolConfig(ext, 'useBase64CQ');
        let imgPart;

        if (useSeal) {
            imgPart = `[图:${data.image_url}]`;
        } else if (useB64) {
            imgPart = `[CQ:image,file=base64://${data.image_base64}]`;
        } else {
            imgPart = `[CQ:image,file=${data.image_url}]`;
        }

        return seal.format(ctx, `${imgPart}\n{$t玩家}今天的老婆是${data.filename}${suffix}`);
    };

    /**
     * 核心业务处理
     * @param {seal.MsgContext} ctx
     * @param {seal.Message} msg
     * @param {boolean} isHlp - 是否为换老婆操作
     */
    const handleWifeRequest = async (ctx, msg, isHlp) => {
        dailyReset(ctx);
        if (!validateConfig(ctx, msg)) return;

        try {
            const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
            const limit = seal.ext.getIntConfig(ext, "daily_hlp_limit");

            logDebug(`用户 ${ctx.player.name} 当前次数: ${todayCount}, 限制: ${limit}, 类型: ${isHlp ? '换老婆' : '查看'}`);

            // 1. 如果是 jrlp 且已经有老婆，直接展示旧的
            if (!isHlp && todayCount > 0) {
                const oldData = {
                    image_url: seal.vars.strGet(ctx, `$m今日老婆`)[0],
                    image_base64: seal.vars.strGet(ctx, `$m今日老婆b64`)[0],
                    filename: seal.vars.strGet(ctx, `$m老婆名字`)[0]
                };
                seal.replyToSender(ctx, msg, formatWifeResponse(ctx, oldData));
                return;
            }

            // 2. 检查次数限制（仅针对 hlp）
            if (isHlp && todayCount >= limit) {
                const oldData = {
                    image_url: seal.vars.strGet(ctx, `$m今日老婆`)[0],
                    image_base64: seal.vars.strGet(ctx, `$m今日老婆b64`)[0],
                    filename: seal.vars.strGet(ctx, `$m老婆名字`)[0]
                };
                const suffix = `\n(每天最多换 ${limit} 次老婆哦)`;
                seal.replyToSender(ctx, msg, formatWifeResponse(ctx, oldData, suffix));
                return;
            }

            // 3. 获取新数据
            const data = await getCharacterData();
            seal.vars.strSet(ctx, `$m今日老婆`, data.image_url);
            seal.vars.strSet(ctx, `$m今日老婆b64`, data.image_base64);
            seal.vars.strSet(ctx, `$m老婆名字`, data.filename);
            seal.vars.strSet(ctx, `$m今日老婆次数`, String(todayCount + 1));

            seal.replyToSender(ctx, msg, formatWifeResponse(ctx, data));

        } catch (error) {
            seal.replyToSender(ctx, msg, "获取老婆失败，后端服务可能暂时不可用");
        }
    };

    // --- 指令注册 ---
    const cmdjrlp = seal.ext.newCmdItemInfo();
    cmdjrlp.name = 'jrlp';
    cmdjrlp.help = '.jrlp 查看今日老婆\n.jrlp status 查看后端状态';
    cmdjrlp.solve = async (ctx, msg, cmdArgs) => {
        if (cmdArgs.getArgN(1) === 'status') {
            const apiUrl = `${seal.ext.getStringConfig(ext, "api_url")}/status`;
            try {
                const res = await fetch(apiUrl);
                const d = await res.json();
                seal.replyToSender(ctx, msg, `API 状态: ${d.service_availability}\nCPU: ${d.system_metrics.cpu_usage_percent}%`);
            } catch (e) {
                seal.replyToSender(ctx, msg, "状态获取失败");
            }
            return seal.ext.newCmdExecuteResult(true);
        }
        await handleWifeRequest(ctx, msg, false);
        return seal.ext.newCmdExecuteResult(true);
    };

    const cmdhlp = seal.ext.newCmdItemInfo();
    cmdhlp.name = 'hlp';
    cmdhlp.help = '.hlp 换一个老婆';
    cmdhlp.solve = async (ctx, msg, cmdArgs) => {
        const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
        if (todayCount === 0) {
            seal.replyToSender(ctx, msg, "你还没有今日老婆哦，先输入 .jrlp 吧");
        } else {
            await handleWifeRequest(ctx, msg, true);
        }
        return seal.ext.newCmdExecuteResult(true);
    };

    ext.cmdMap['jrlp'] = cmdjrlp;
    ext.cmdMap['今日老婆'] = cmdjrlp;
    ext.cmdMap['hlp'] = cmdhlp;
    ext.cmdMap['换老婆'] = cmdhlp;

    // --- 关键词监听 ---
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
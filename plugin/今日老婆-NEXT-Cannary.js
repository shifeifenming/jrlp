// ==UserScript==
// @name        今日老婆
// @author      是非，艾因，群友
// @version     1.1.0
// @description jrlp获取今日老婆，hlp换一个老婆（有次数限制）
// @timestamp
// @license     Apache-2
// ==/UserScript==

if (!seal.ext.find('今日老婆')) {

    const ext = seal.ext.new('今日老婆', '群友，艾因，是非， ', '1.1.0');
    seal.ext.register(ext);
    seal.ext.registerStringConfig(ext, "api_url", "http://localhost:18428", "jrlp 后端地址 [ 注意：必须以 http(s):// 开头，且结尾不能有 / ]");
    seal.ext.registerIntConfig(ext, "daily_hlp_limit", 5, "每天最多换老婆次数");

    /**
     * 每日重置函数，在每次执行命令前调用
     * @param {object} ctx - 上下文对象
     */
    const dailyReset = (ctx) => {
        const currentDay = seal.vars.intGet(ctx, `$tDay`)[0];
        const lastUpdatedDay = parseInt(seal.vars.strGet(ctx, `$m时间变量`)[0]) || 0;

        if (currentDay !== lastUpdatedDay) {
            seal.vars.strSet(ctx, `$m时间变量`, String(currentDay));
            seal.vars.strSet(ctx, `$m今日老婆次数`, "0");
        }
    };
    
    /**
     * 异步函数：调用本地 API 获取随机角色数据
     * @return {Promise<Object>} 返回一个包含文件名和图片 URL 的 Promise 对象
     */
    async function getCharacterData() {
        const apiUrl = seal.ext.getStringConfig(ext, "api_url") + '/api/character';

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`[jrlp.HTTP.ERROR] 状态码: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[jrlp.request.ERROR]:', error);
            throw error;
        }
    }

    async function getApiStatus() {
        const apiUrl = seal.ext.getStringConfig(ext, "api_url") + '/status';
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`[jrlp.HTTP.ERROR] 状态码: ${response.status}`);
            }
            const data = await response.json();

            let result = `API 状态: ${data.service_availability}\n系统状态: [CPU: ${data.system_metrics.cpu_usage_percent}% | RAM: ${data.system_metrics.memory_usage.used_gb}GB/${data.system_metrics.memory_usage.total_gb}GB ${data.system_metrics.memory_usage.percent}%]\n访问统计: [jrlp: ${data.access_statistics["/api/character"]} | status: ${data.access_statistics["/status"]}]`;
            return result;

        } catch (error) {
            console.error('[jrlp.request.ERROR]:', error);
            throw '获取服务状态失败，请检查后端是否运行';
        }
    }

    /**
     * 处理获取老婆的通用请求逻辑
     * @param {object} ctx - 上下文对象
     * @param {object} msg - 消息对象
     * @param {boolean} isHlp - 是否为 hlp 命令
     */
    const handleWifeRequest = async (ctx, msg, isHlp) => {
        try {
            const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
            const daily_hlp_limit = seal.ext.getIntConfig(ext, "daily_hlp_limit");

            if (isHlp && todayCount >= daily_hlp_limit) {
                const wifeImg = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                const wifeName = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                const messageSuffix = `(一天最多换 ${daily_hlp_limit} 次老婆哦)`;
                seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${wifeImg}]\n{$t玩家}今天的老婆是${wifeName}${messageSuffix}`));
                return;
            }

            const data = await getCharacterData();
            const { filename, image_url } = data;

            // 更新变量并增加计数
            seal.vars.strSet(ctx, `$m今日老婆`, image_url);
            seal.vars.strSet(ctx, `$m老婆名字`, filename);
            const newCount = todayCount + 1;
            seal.vars.strSet(ctx, `$m今日老婆次数`, String(newCount));

            seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${image_url}]\n{$t玩家}今天的老婆是${filename}`));

        } catch (error) {
            console.error('Error:', error);
            seal.replyToSender(ctx, msg, '获取老婆失败，请稍后再试');
        }
    };

    ext.onNotCommandReceived = async (ctx, msg) => {
        dailyReset(ctx);
        const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
        
        // 更简单的命令匹配
        const jrlpCommands = ['jrlp', '今日老婆'];
        const hlpCommands = ['hlp', '换老婆'];
        const trimmedMsg = msg.message.replace(/\[CQ:at,qq=.*?\]\s*/, '').trim();

        if (jrlpCommands.includes(trimmedMsg)) {
            if (todayCount === 0) {
                await handleWifeRequest(ctx, msg, false);
            } else {
                const wifeImg = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                const wifeName = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${wifeImg}]\n{$t玩家}今天的老婆是${wifeName}`));
            }
        } else if (hlpCommands.includes(trimmedMsg)) {
            if (todayCount === 0) {
                seal.replyToSender(ctx, msg, seal.format(ctx, `你还没有今日老婆哦，输入jrlp获取一个吧`));
            } else {
                await handleWifeRequest(ctx, msg, true);
            }
        }
    };

    const cmdjrlp = seal.ext.newCmdItemInfo();
    cmdjrlp.name = '今日老婆';
    cmdjrlp.help = '使用 .jrlp status 查看服务状态，不加参数将返回今日老婆';
    cmdjrlp.solve = async (ctx, msg, cmdArgs) => {
        dailyReset(ctx);
        const val = cmdArgs.getArgN(1);
        
        if (val === 'status') {
            try {
                const statusMessage = await getApiStatus();
                seal.replyToSender(ctx, msg, statusMessage);
            } catch (error) {
                seal.replyToSender(ctx, msg, String(error));
            }
        } else {
            const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
            if (todayCount === 0) {
                await handleWifeRequest(ctx, msg, false);
            } else {
                const wifeImg = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                const wifeName = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${wifeImg}]\n{$t玩家}今天的老婆是${wifeName}`));
            }
        }
        return seal.ext.newCmdExecuteResult(true);
    };

    const cmdhlp = seal.ext.newCmdItemInfo();
    cmdhlp.name = '换老婆';
    cmdhlp.help = '更换今日老婆';
    cmdhlp.solve = async (ctx, msg, cmdArgs) => {
        dailyReset(ctx);
        const todayCount = parseInt(seal.vars.strGet(ctx, `$m今日老婆次数`)[0]) || 0;
        
        if (todayCount === 0) {
            seal.replyToSender(ctx, msg, seal.format(ctx, `你还没有今日老婆哦，输入jrlp获取一个吧`));
        } else {
            await handleWifeRequest(ctx, msg, true);
        }
        return seal.ext.newCmdExecuteResult(true);
    }
    
    ext.cmdMap['jrlp'] = cmdjrlp;
    ext.cmdMap['今日老婆'] = cmdjrlp;
    ext.cmdMap['hlp'] = cmdhlp;
    ext.cmdMap['换老婆'] = cmdhlp;
};

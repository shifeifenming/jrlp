// ==UserScript==
// @name         今日老婆
// @author       是非，艾因，群友
// @version      1.0.0
// @description  jrlp获取今日老婆，hlp换一个老婆（有次数限制）
// @timestamp    
// @license      Apache-2
// ==/UserScript==

// 更改项:
// l -> currentDay
// w -> lastUpdatedDay
// s -> today
// kt -> todayCount
// k -> newCount
// url -> apiUrl
// data_img -> wifeImg
// data_name -> wifeName
// onNotCommandReceived 已改为异步
// 所有 var 已被替换为 let 或 const
// handleWifeRequest 函数抽象并调用，减少代码重复
// 所有非内置 vars 操作都已添加加密/解密逻辑
// 适应新的 API 返回格式

if (!seal.ext.find('今日老婆')) {
    class SimpleCipher {
        constructor() {
            // 你应该严密的保护这个密钥↓
            this.key = '12345678987654321';
        }

        /**
         * 加密或解密数据
         * @param {string} data - 要加密或解密的字符串
         * @returns {string} - 加密或解密后的字符串
         */
        cipher(data) {
            let result = '';
            for (let i = 0; i < data.length; i++) {
                const dataCharCode = data.charCodeAt(i);
                const keyCharCode = this.key.charCodeAt(i % this.key.length);
                const cipherCharCode = dataCharCode ^ keyCharCode;
                result += String.fromCharCode(cipherCharCode);
            }
            return result;
        }
    }

    const cipher = new SimpleCipher();

    /**
     * 获取加密后的变量，并自动解密
     * @param {object} ctx - 上下文对象
     * @param {string} varName - 变量名
     * @returns {string} - 解密后的字符串
     */
    function getDecryptedVar(ctx, varName) {
        let value = seal.vars.strGet(ctx, varName)[0];
        if (value) {
            return cipher.cipher(value);
        }
        return '';
    }

    /**
     * 加密值并设置变量
     * @param {object} ctx - 上下文对象
     * @param {string} varName - 变量名
     * @param {*} value - 要设置的值
     */
    function setEncryptedVar(ctx, varName, value) {
        let encryptedValue = cipher.cipher(String(value));
        seal.vars.strSet(ctx, varName, encryptedValue);
    }

    /**
     * 异步函数：调用本地 API 获取随机角色数据
     * @return {Promise<Object>} 返回一个包含文件名和图片 URL 的 Promise 对象
     */
    async function getCharacterData() {
        const apiUrl = 'http://localhost:18428/api/character';

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`[jrlp.HTTP.ERROR] 状态码: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[jrlp.requset.ERROR]:', error);
            throw error;
        }
    }

    const ext = seal.ext.new('今日老婆', '群友，艾因，是非， ', '1.0.0');
    seal.ext.register(ext);

    /**
     * 处理获取老婆的通用请求逻辑
     * @param {object} ctx - 上下文对象
     * @param {object} msg - 消息对象
     * @param {boolean} isHlp - 是否为 hlp 命令
     */
    const handleWifeRequest = async (ctx, msg, isHlp) => {
        try {
            const data = await getCharacterData();
            const { filename, image_url } = data;
            
            let currentCount = parseInt(getDecryptedVar(ctx, `$m今日老婆次数`)) || 0;
            let messageSuffix = '';

            if (isHlp) {
                if (currentCount >= 6) {
                    const wifeImg = getDecryptedVar(ctx, `$m今日老婆`);
                    const wifeName = getDecryptedVar(ctx, `$m老婆名字`);
                    messageSuffix = '(一天最多换五次老婆喵)';
                    seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${wifeImg}]\n{$t玩家}今天的老婆是${wifeName}${messageSuffix}`));
                    return;
                }
            }

            // 更新变量并增加计数
            setEncryptedVar(ctx, `$m今日老婆`, image_url);
            setEncryptedVar(ctx, `$m老婆名字`, filename);
            currentCount++;
            setEncryptedVar(ctx, `$m今日老婆次数`, currentCount);
            
            seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${image_url}]\n{$t玩家}今天的老婆是${filename}`));

        } catch (error) {
            console.error('Error:', error);
            seal.replyToSender(ctx, msg, '获取老婆失败，请稍后再试');
        }
    };
    
    ext.onNotCommandReceived = async (ctx, msg) => {

        const currentDay = seal.vars.intGet(ctx, `$tDay`)[0];
        
        // 获取加密变量并解密
        const lastUpdatedDayStr = getDecryptedVar(ctx, `$m时间变量`);
        const todayCountStr = getDecryptedVar(ctx, `$m今日老婆次数`);
        
        const lastUpdatedDay = parseInt(lastUpdatedDayStr) || 0;
        let todayCount = parseInt(todayCountStr) || 0;

        // 每日重置
        if (currentDay != lastUpdatedDay) {
            setEncryptedVar(ctx, `$m时间变量`, currentDay);
            setEncryptedVar(ctx, `$m今日老婆次数`, 0);
            todayCount = 0; // 重置计数器
        }

        // 命令处理
        const jrlpCommands = ['jrlp', '[CQ:at,qq=2152423110] jrlp', '[CQ:at,qq=2152423110]jrlp'];
        if (jrlpCommands.includes(msg.message)) {
            if (todayCount === 0) {
                await handleWifeRequest(ctx, msg, false);
            } else {
                const wifeImg = getDecryptedVar(ctx, `$m今日老婆`);
                const wifeName = getDecryptedVar(ctx, `$m老婆名字`);
                seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${wifeImg}]\n{$t玩家}今天的老婆是${wifeName}`));
            }
        } else if (msg.message === 'hlp') {
            if (todayCount === 0) {
                seal.replyToSender(ctx, msg, seal.format(ctx, `你还没有今日老婆哦，输入jrlp获取一个吧`));
            } else {
                await handleWifeRequest(ctx, msg, true);
            }
        }
    };
}
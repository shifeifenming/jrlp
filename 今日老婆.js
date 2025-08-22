// ==UserScript==
// @name         今日老婆
// @author       是非，艾因，群友
// @version      1.0.0
// @description  jrlp和hlp
// @timestamp    
// @license      Apache-2
// ==/UserScript==
if (!seal.ext.find('今日老婆')) {
    const ext = seal.ext.new('今日老婆', '群友，艾因，是非， ', '1.0.0');
    seal.ext.register(ext);
    const url = 'http://localhost:18428/api/character';
    
    ext.onNotCommandReceived = (ctx, msg) => {
        var l = seal.vars.intGet(ctx, `$tDay`)[0];
        var w = seal.vars.intGet(ctx, `$m时间变量`)[0];
        if ( l!=w ) {
            var s = seal.vars.intGet(ctx, `$tDay`)[0];
            seal.vars.intSet(ctx, `$m时间变量`, s);
            seal.vars.intSet(ctx, `$m今日老婆次数`,0);
        }
        var kt = seal.vars.intGet(ctx, `$m今日老婆次数`)[0];
        if (msg.message === 'jrlp' || msg.message === '[CQ:at,qq=2152423110] jrlp') {
            if (kt == 0) {
                fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error('API请求失败');
                        return response.json();
                    })
                    .then(data => {
                        var k = seal.vars.intGet(ctx, `$m今日老婆次数`)[0];
                        k = k + 1;
                        seal.vars.intSet(ctx, `$m今日老婆次数`,k);
                        seal.vars.strSet(ctx, `$m今日老婆`,data.img);
                        seal.vars.strSet(ctx, `$m老婆名字`,data.name);
                        var data_img = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                        var data_name = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                        seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${data_img}]\n{$t玩家}今天的老婆是${data_name}`));
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        seal.replyToSender(ctx, msg, '获取老婆失败，请稍后再试。');
                    });
            }
            else {
                var data_img = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                var data_name = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${data_img}]\n{$t玩家}今天的老婆是${data_name}`));
            }
        }
        if (msg.message === 'hlp') {
            var k = seal.vars.intGet(ctx, `$m今日老婆次数`)[0];
            if (k == 0) {
                seal.replyToSender(ctx, msg, seal.format(ctx, `你还没有今日老婆哦，输入jrlp获取一个吧`));
            }
            else {
                fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error('API请求失败');
                        return response.json();
                    })
                    .then(data => {
                        var k = seal.vars.intGet(ctx, `$m今日老婆次数`)[0];
                        if (Number(k) <= 6) {
                            seal.vars.strSet(ctx, `$m今日老婆`, data.img);
                            seal.vars.strSet(ctx, `$m老婆名字`, data.name);
                            var data_img = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                            var data_name = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                            var k = seal.vars.intGet(ctx, `$m今日老婆次数`)[0];
                            k = k + 1;
                            seal.vars.intSet(ctx, `$m今日老婆次数`, k);
                            seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${data_img}]\n{$t玩家}今天的老婆是${data_name}`));
                        }
                        else {
                            var data_img = seal.vars.strGet(ctx, `$m今日老婆`)[0];
                            var data_name = seal.vars.strGet(ctx, `$m老婆名字`)[0];
                            seal.replyToSender(ctx, msg, seal.format(ctx, `[CQ:image,file=${data_img}]\n{$t玩家}今天的老婆是${data_name}(一天最多换五次老婆喵)`)); 
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        seal.replyToSender(ctx, msg, '获取老婆失败，请稍后再试。');
                    });
            }
        }
    };
}
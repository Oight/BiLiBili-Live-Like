const {chromium} = require('playwright');
const fs  = require('fs');
const { time } = require('console');


const CONFIG = {
    livePath:  './live_number.json',
    cookiePath: './bilibili_cookies.json',
    liveBaseUrl: 'https://live.bilibili.com/',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
    pageTimeout: 30000,
    jumpDelay: 1000
}

/**
 * @returns {Array}
 */
function getlives() {
    try {
        if (!fs.existsSync(CONFIG.livePath)) {
        console.error(`❌ 直播间文件 ${CONFIG.livePath} 不存在，请检查文件路径！`);
        return [];
        }

        const Data = fs.readFileSync(CONFIG.livePath, 'utf-8');
        const rawlist = JSON.parse(Data);

        const lives = rawlist.map(item => {
            const liveNum = item.liveNum.toString().trim();
            return {
                url: CONFIG.liveBaseUrl + liveNum,
                likeCount: item.likeCount || 50,
                likeDelay: item.likeDelay || 600
            };
        });
        if (lives.length === 0) {
        throw new Error('配置文件数组为空，请添加直播间号');
        }
    console.log(`✅ 成功读取配置文件，共检测到${lives.length}个直播间`);
        return lives;
    } catch (error) {
        console.error('❌ 直播间文件内容格式错误，无法解析为JSON数组！');
        return [];
    }
}

/**
 *
 * @param {Object} page
 * @param {Object} live
 * @returns {Boolean}
 */

async function likeLiveRoom(page, live) {
    const {url, likeCount, likeDelay} = live;

    try {
        console.log(`🔧 配置：点赞${likeCount}次，每次间隔${likeDelay}ms`);
        await page.goto(url, {
            timeout: CONFIG.pageTimeout,
            waitUntil: 'networkidle'
        });

        const likeButtonSelector = '.like-btn';
        await page.waitForSelector(
            likeButtonSelector,
            {   state: 'visible',
                timeout: CONFIG.pageTimeout
            }
        );

        const likeButton = page.locator(likeButtonSelector);
         console.log(`👍 点赞按钮定位成功，准备循环点赞`);

         for (let i = 0; i < likeCount; i++) {
            await likeButton.click();
            console.log(`❤️ 第 ${i + 1}/${likeCount} 次点赞成功！`);
            if (i < likeCount - 1) {
                await page.waitForTimeout(likeDelay);
            }
        }
        console.log(`🎉 直播间【${url}】点赞操作完成！`);
        return true;
    } catch (error) {
    console.error(`❌ 直播间【${url}】处理失败：${error.message}`);
    return false;
  }
}

async function main() {

    const lives = getlives();
    if (lives.length === 0) {
        return false;
    }

    if (!fs.existsSync(CONFIG.cookiePath)) {
        console.error(`❌ Cookie文件 ${CONFIG.cookiePath} 不存在，请先运行登录脚本！`);
        return false;
    }

    let browser, context, page;

    try {
        browser = await chromium.launch({
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled'
            ]
        });

        context = await browser.newContext({
            userAgent: CONFIG.userAgent,
        });

        await context.addInitScript(() => {
            Object.defineProperties(navigator, {
                webdriver: { get: () => undefined },
                _phantom: { get: () => undefined },
                __driver_evaluate: { get: () => undefined }
            });
        });

        const cookies = JSON.parse(fs.readFileSync(CONFIG.cookiePath, 'utf-8'));
        await context.addCookies(cookies);

        page = await context.newPage();
        console.log(`\n📋 开始依次处理所有直播间，共${lives.length}个...`);

        let successCount = 0;

        for (let [index, live] of lives.entries()) {
            const isSuccess = await likeLiveRoom(page, live);
            if (isSuccess) successCount++;

            if (index < lives.length - 1) {
                console.log(`\n⌛ 等待${CONFIG.jumpDelay/1000}秒，准备跳转到下一个直播间...`);
                await page.waitForTimeout(CONFIG.jumpDelay);
            }
        }

        console.log(`\n✅ 全部直播间处理完成！成功：${successCount}，失败：${lives.length - successCount}`);
        await browser.close();
        return true;
    } catch (error) {
        console.error('❌ 脚本执行失败，出现未知错误！', error.message);
        await browser?.close();
        return false;
    }
}

main();

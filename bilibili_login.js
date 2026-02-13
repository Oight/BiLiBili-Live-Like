const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    cookiePath: './bilibili_cookies.json',
    scanTimeout: 300000,
    pageTimeout: 30000,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0'
}

async function bilibili_Login() {
    const dir = path.dirname(CONFIG.cookiePath);
    let browser, context, page;

    try {
        browser = await chromium.launch({
            headless: false,
            args: [
               // '--no-sandbox',
                '--disbale-blink-features=AutomationControlled',
                '--start-maximized'
            ],
            slowMo: 0
        });

        context = await browser.newContext({
            userAgent: CONFIG.userAgent,
            viewport: {width: 1920, height: 1080},
            noDefaultViewport: true
        });

        await context.addInitScript(() => {
            Object.defineProperties(navigator, {
                webdriver: { get: () => undefined },
                _phantom: { get: () => undefined }
            });
        });

        page = await context.newPage();
        console.log('✅ 浏览器窗口已打开，请在弹出的窗口中完成扫码登录！');
        console.log('⌛ 扫码限时5分钟，超时请重新运行脚本');

        await page.goto('https://passport.bilibili.com/login', {
            timeout: CONFIG.pageTimeout,
            waitUntil: 'networkidle'
        });

        await page.waitForURL(
            (url) => url.host.includes('bilibili.com') && !url.pathname.includes('login'),
            {timeout: CONFIG.scanTimeout}
        );

        const cookies = await context.cookies();
        fs.writeFileSync(CONFIG.cookiePath, JSON.stringify(cookies, null, 2));
        console.log(`✅ 登录成功，Cookie已保存至 ${CONFIG.cookiePath} 文件！`);

        await browser.close();
        return true;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            console.log('❌ 登录超时，未检测到登录成功，请重新运行脚本！');
        } else if (error.message.includes('waitForSelector')) {
            console.log('❌ 页面加载失败，未找到登录确认元素，请重新运行脚本！');
        } else {
            console.log('❌ 登录失败，出现未知错误！', error.message);
        }
        await browser?.close();
        return false;
    }
}
bilibili_Login();

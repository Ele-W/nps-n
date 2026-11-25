// 通过普通开发依赖加载，不把作者本机的 Node.js/浏览器路径写入仓库。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
// 临时报告与截图单独存放；需要更新文档截图时显式传入 --update-previews。
const out = path.join(__dirname, '.verification');
fs.mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];
function check(condition, description) { if (!condition) throw new Error(description); checks.push(description); }
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.NPS_PROTOTYPE_BROWSER?{executablePath:process.env.NPS_PROTOTYPE_BROWSER}:{})});
  const context = await browser.newContext({viewport:{width:1056,height:1020},colorScheme:'light'});
  // 在离线上下文中验证，确保图标与主要交互不依赖在线 CDN 或 Codex 宿主。
  await context.setOffline(true);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  const frame = page;
  await frame.locator('.np-desktop .np-pagetitle').waitFor();
  await page.waitForTimeout(700);
  check(await frame.locator('.np-desktop .np-row').count()===4,'桌面概览显示当前示例账户的四条隧道');
  await page.screenshot({path:path.join(out,'nps-desktop-light.png'),fullPage:true});
  await frame.locator('[data-surface="web"]').click();
  const web = frame.locator('.np-web');
  check(await web.locator('tbody tr').count()===4,'Web 隧道清单可见');
  await web.locator('.np-searchinput').fill('NAS');
  check(await web.locator('tbody tr').count()===1,'搜索按名称过滤隧道');
  await web.locator('.np-searchinput').fill('');
  await web.locator('.np-filter').selectOption('paused');
  check(await web.locator('tbody tr').count()===1,'状态筛选显示已暂停项');
  await web.locator('.np-filter').selectOption('all');
  await web.locator('[data-detail="l1"]').first().click();
  check(await web.locator('.np-panel').innerText().then(t=>t.includes('127.0.0.1:3000')),'隧道详情包含配置与应用状态');
  await web.locator('[data-action="closepanel"]').click();
  await web.locator('[data-toggle="l1"]').click();
  check(await web.locator('tbody tr').first().innerText().then(t=>t.includes('已暂停')),'暂停动作更新清单状态');
  await web.locator('[data-toggle="l1"]').click();
  await page.screenshot({path:path.join(out,'nps-web-light.png'),fullPage:true});
  await web.locator('[data-action="new"]').click();
  await web.locator('[data-action="wizardnext"]').click();
  await web.locator('[data-action="wizardnext"]').click();
  check(await web.locator('.np-error').isVisible(),'空名称出现就地错误提示');
  await web.locator('[name="name"]').fill('测试预览站点');
  await web.locator('[name="target"]').fill('bad');
  await web.locator('[data-action="wizardnext"]').click();
  check(await web.locator('.np-error').innerText().then(t=>t.includes('地址格式')),'无效本地地址阻止进入确认');
  await web.locator('[name="target"]').fill('127.0.0.1:4567');
  await web.locator('[name="entry"]').fill('dev.example.com');
  await web.locator('[data-action="wizardnext"]').click();
  check(await web.locator('.np-error').innerText().then(t=>t.includes('已被占用')),'重复公开入口显示冲突原因');
  await web.locator('[name="entry"]').fill('preview-test.example.com');
  await web.locator('[data-action="wizardnext"]').click();
  check(await web.locator('.np-summary').innerText().then(t=>t.includes('测试预览站点')),'确认步骤保留用户输入');
  await page.screenshot({path:path.join(out,'nps-web-wizard.png'),fullPage:true});
  await web.locator('[data-action="wizardsave"]').click();
  check(await web.locator('tbody tr').count()===5,'保存后创建示例隧道');
  check(await web.locator('tbody tr').first().innerText().then(t=>t.includes('应用中')),'保存与设备应用状态分开');
  await page.waitForTimeout(1500);
  check(await web.locator('tbody tr').first().innerText().then(t=>t.includes('运行中')),'模拟回执更新生效状态');
  await web.locator('.np-account').selectOption('chen');
  check(await web.locator('tbody tr').count()===1,'切换示例账户后只显示该账户的隧道');
  check(!await web.locator('.np-body').innerText().then(t=>t.includes('本地开发站点')||t.includes('测试预览站点')),'示例账户切换清除上一账户的详情与清单');
  await web.locator('.np-account').selectOption('lin');
  await web.locator('[data-nav="devices"]').click();
  check(await web.locator('.np-devicecard').count()===2,'设备页显示当前账户设备');
  await web.locator('[data-nav="tunnels"]').click();
  await frame.locator('[data-surface="desktop"]').click();
  const desktop = frame.locator('.np-desktop');
  await desktop.locator('[data-action="connection"]').click();
  await desktop.locator('[data-nav="tunnels"]').click();
  await desktop.locator('.np-filter').selectOption('pending');
  check(await desktop.locator('.np-row').count()===4,'设备离线时状态筛选与清单显示一致');
  await desktop.locator('[data-nav="overview"]').click();
  await desktop.locator('[data-action="connection"]').click();
  await desktop.locator('.np-account').selectOption('chen');
  check(await desktop.locator('.np-maclights').isVisible(),'Mac 示例账户展示 macOS 窗口样式');
  await page.screenshot({path:path.join(out,'nps-desktop-mac-light.png'),fullPage:true});
  await desktop.locator('.np-account').selectOption('lin');
  await frame.locator('[data-surface="admin"]').click();
  const admin = frame.locator('.np-admin');
  check(await admin.locator('tbody tr').count()===3,'管理端展示账户清单');
  check(!await admin.locator('.np-body').innerText().then(t=>t.includes('127.0.0.1')||t.includes('dev.example.com')),'管理员清单不展示用户连接配置');
  await admin.locator('[data-quota="u1"]').click();
  await admin.locator('[name="deviceQuota"]').fill('1');
  await admin.locator('[data-save-quota="u1"]').click();
  check(await admin.locator('.np-error').isVisible(),'管理员不能把配额降到已用数量以下');
  await admin.locator('[name="deviceQuota"]').fill('8');
  await admin.locator('[data-save-quota="u1"]').click();
  check(await admin.locator('tbody tr').first().innerText().then(t=>t.includes('2 / 8')),'管理端配额变更更新列表');
  await admin.locator('[data-user-state="u2"]').click();
  check(await admin.locator('.np-panel').innerText().then(t=>t.includes('1 台设备')&&t.includes('1 条隧道')),'停用前明确展示受影响资源');
  await admin.locator('[data-confirm-user="u2"]').click();
  check(await admin.locator('tbody tr').nth(1).innerText().then(t=>t.includes('已停用')),'确认后更新账户状态示例');
  await page.waitForTimeout(3700);
  await page.screenshot({path:path.join(out,'nps-admin-light.png'),fullPage:true});
  await frame.locator('[data-surface="web"]').click();
  for (const width of [1024,736,480,320]) {
    await page.setViewportSize({width:width+32,height:1600});
    await page.waitForTimeout(100);
    const overflow=await frame.locator('#nps-v2-design').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
    check(overflow.scroll<=overflow.width+1,`Web 在 ${width}px 宽度无根部横向溢出`);
    await frame.locator('[data-surface="desktop"]').click();
    const desktopOverflow=await frame.locator('#nps-v2-design').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
    check(desktopOverflow.scroll<=desktopOverflow.width+1,`桌面设计在 ${width}px 宽度无根部横向溢出`);
    await frame.locator('[data-surface="web"]').click();
    await web.locator('[data-action="new"]').click();
    const wizardOverflow=await frame.locator('#nps-v2-design').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
    check(wizardOverflow.scroll<=wizardOverflow.width+1,`新建向导在 ${width}px 宽度无横向溢出`);
    await web.locator('[data-action="closepanel"]').first().click();
    await frame.locator('[data-surface="admin"]').click();
    const adminOverflow=await frame.locator('#nps-v2-design').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
    check(adminOverflow.scroll<=adminOverflow.width+1,`管理端在 ${width}px 宽度无横向溢出`);
    await frame.locator('[data-surface="web"]').click();
  }
  await page.screenshot({path:path.join(out,'nps-mobile-light.png'),fullPage:true});
  await page.setViewportSize({width:1056,height:1020});
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForTimeout(150);
  await page.screenshot({path:path.join(out,'nps-web-dark.png'),fullPage:true});
  check(await frame.locator('.np-app:not([hidden]) i[data-lucide]').count()===0,'离线图标库成功初始化当前视图图标');
  // 检查用户在评审中确认的视觉参数，避免导出或重绘时退回旧值。
  const designValues = await page.locator('#nps-v2-design').evaluate(el=>({density:getComputedStyle(el).getPropertyValue('--np-list-padding').trim(),radius:getComputedStyle(el).getPropertyValue('--np-panel-radius').trim()}));
  check(designValues.density==='10px'&&designValues.radius==='11px','离线原型保留列表间距10px与面板圆角11px');
  check(errors.length===0,'浏览器无 JavaScript 运行时错误');
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
  if(process.argv.includes('--update-previews')){
    const previews=path.join(__dirname,'previews');
    fs.mkdirSync(previews,{recursive:true});
    // 文档只保留四张代表性截图，其余验证截图不进入 Git。
    for(const [source,destination] of [['nps-desktop-light.png','desktop-windows.png'],['nps-desktop-mac-light.png','desktop-macos.png'],['nps-web-light.png','web.png'],['nps-admin-light.png','admin.png']]){
      fs.copyFileSync(path.join(out,source),path.join(previews,destination));
    }
  }
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});

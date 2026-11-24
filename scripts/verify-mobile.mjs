import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const url=(await readFile('.mobile-test-url','utf8')).trim();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);await page.waitForFunction(()=>document.querySelector('#train')?.textContent?.trim()!=='â€”');
await page.waitForTimeout(1500);
await page.screenshot({path:'docs/verification/mobile-journey.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
await page.getByRole('button',{name:'Mapa',exact:true}).click();await page.waitForTimeout(1500);
await page.screenshot({path:'docs/verification/mobile-map.png',fullPage:true});
const result={errors,overflow,paired:!page.url().includes('pair='),status:await page.locator('#connection').textContent()};
await writeFile('docs/verification/mobile-results.json',JSON.stringify(result,null,2));console.log(result);
await browser.close();if(errors.length||overflow)process.exitCode=1;


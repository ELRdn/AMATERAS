import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const origin=process.env.AMATERAS_URL??"http://127.0.0.1:8787";
const local=resolve("artifacts/playwright-browsers/chromium-1243/chrome-win64/chrome.exe");
const browser=await chromium.launch({headless:true,...(existsSync(local)?{executablePath:local}:{})});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[],csp=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error"&&/content security|violat.*policy/i.test(m.text()))csp.push(m.text());});
try{
 await mkdir("artifacts/fx",{recursive:true});
 await page.goto(origin+"/?scenario=severe");
 await expect(page.getByText("MOCK DATA",{exact:true})).toHaveCount(0);
 await expect(page.locator(".map-canvas")).toHaveAttribute("data-mode","3d");
 await page.waitForTimeout(3000);
 const health=await (await page.request.get(origin+"/api/health")).json();
 const events={};
 for(const id of ["earthquakes","typhoons"]){
  const body=await (await page.request.get(origin+"/api/"+id)).json();
  expect(body.health.state).toBe("LIVE");
  events[id]=body.data.length;
  await page.getByRole("tab",{name:id==="earthquakes"?"地震":"台風",exact:true}).click();
  if(body.data.length){
   await page.locator(".event-select").first().click();
   await expect(page.locator(".event-detail")).toBeVisible();
   await page.waitForTimeout(1800);
  }
  await page.screenshot({path:"artifacts/fx/live-"+id+".png"});
 }
 await page.getByRole("button",{name:"テーマを切り替える"}).click();
 await page.waitForTimeout(2500);
 await expect(page.locator(".map-canvas canvas")).toHaveCount(1);
 await page.screenshot({path:"artifacts/fx/live-light.png"});
 await page.setViewportSize({width:390,height:844});
 await page.locator(".mobile-warning-toggle").click();
 if(await page.locator(".event-select").count())await page.locator(".event-select").first().click();
 await page.waitForTimeout(2000);
 await page.screenshot({path:"artifacts/fx/live-mobile.png"});
 const report={at:new Date().toISOString(),origin,health,events,errors,csp,mockDataVisible:false,canvases:await page.locator(".map-canvas canvas").count(),mode:await page.locator(".map-canvas").getAttribute("data-mode")};
 await writeFile("artifacts/fx/live-browser.json",JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 expect(errors).toEqual([]);expect(csp).toEqual([]);expect(report.mode).toBe("3d");
}finally{await browser.close();}

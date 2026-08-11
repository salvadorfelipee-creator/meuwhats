// Regenera assets/reels-frame.png a partir de assets/reels-frame-fonte.html.
// Rodar depois de editar o HTML: node assets/gerar-moldura.js
// (precisa do playwright instalado — já é devDependency do projeto)
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.join(__dirname, "reels-frame-fonte.html"));
  await page.screenshot({ path: path.join(__dirname, "reels-frame.png"), omitBackground: true });
  await browser.close();
  console.log("assets/reels-frame.png atualizado.");
})();

const fs = require("fs");
const path = require("path");

function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      walk(file);
      continue;
    }
    if (!name.endsWith(".html")) continue;

    let html = fs.readFileSync(file, "utf8");
    html = html
      .replace('<link rel="stylesheet" href="chat.css"/>', '<link rel="stylesheet" href="/chat.css"/>')
      .replace('<script src="chat.js" defer></script>', '<script src="/chat.js" defer></script>');
    if (!html.includes('href="/chat.css"')) {
      html = html.replace(/<\/head>/i, '<link rel="stylesheet" href="/chat.css"/>\n</head>');
    }
    if (!html.includes('src="/chat.js"')) {
      html = html.replace(/<\/body>/i, '<script src="/chat.js" defer></script>\n</body>');
    }
    fs.writeFileSync(file, html);
  }
}

walk(path.join(__dirname, "..", "felizcred-site"));

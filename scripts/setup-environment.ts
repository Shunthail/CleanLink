import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(".env");
if (existsSync(file)) {
  console.log("Le fichier .env existe déjà. Aucun identifiant modifié.");
} else {
  const content =
    [
      "APP_URL=http://localhost:3020",
      "MYSQL_HOST=127.0.0.1",
      "MYSQL_PORT=3307",
      "MYSQL_DATABASE=cleanlink",
      "MYSQL_USER=cleanlink",
      `MYSQL_PASSWORD=${randomBytes(24).toString("hex")}`,
      `MYSQL_ROOT_PASSWORD=${randomBytes(24).toString("hex")}`,
    ].join("\n") + "\n";
  writeFileSync(file, content, { mode: 0o600, flag: "wx" });
  console.log("Configuration créée dans .env (exclu de Git).");
}

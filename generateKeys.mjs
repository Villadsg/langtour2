import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { writeFileSync } from "fs";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
publicKey.alg = "RS256";

const jwks = JSON.stringify({ keys: [publicKey] });

// Save to keys.json
const keysData = {
  JWT_PRIVATE_KEY: privateKey,
  JWKS: jwks,
  SITE_URL: "http://localhost:5173"
};

writeFileSync("keys.json", JSON.stringify(keysData, null, 2));
console.log("\n✓ Keys saved to keys.json\n");

console.log("=== Add these to your Convex Dashboard Environment Variables ===\n");
console.log("JWT_PRIVATE_KEY:");
console.log(privateKey);
console.log("\nJWKS:");
console.log(jwks);
console.log("\nSITE_URL:");
console.log("http://localhost:5173");
console.log("\n=== End of keys ===\n");

import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
publicKey.alg = "RS256";

console.log("\n=== Add these to your Convex Dashboard Environment Variables ===\n");
console.log("JWT_PRIVATE_KEY:");
console.log(privateKey);
console.log("\nJWKS:");
console.log(JSON.stringify({ keys: [publicKey] }));
console.log("\n=== End of keys ===\n");

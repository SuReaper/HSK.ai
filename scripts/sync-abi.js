const fs = require("fs");
const path = require("path");

function generate(name, artifactPath, tsPath, bytecodeExport, abiExport) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const raw = artifact.bytecode.object;
  const bytecode = raw.startsWith("0x") ? raw : "0x" + raw;
  const abi = JSON.stringify(artifact.abi, null, 2);

  const content = `// Auto-generated from Foundry artifacts. Rebuild with: forge build && node scripts/sync-abi.js
export const ${bytecodeExport} = "${bytecode}" as const;

export const ${abiExport} = ${abi} as const;
`;

  fs.writeFileSync(tsPath, content);
  console.log(`${name}: bytecode ${bytecode.length} chars, ABI ${artifact.abi.length} entries → ${tsPath}`);
}

generate(
  "HSKIntentAnchor",
  path.join(__dirname, "..", "out", "HSKIntentAnchor.sol", "HSKIntentAnchor.json"),
  path.join(__dirname, "..", "src", "lib", "anchors", "anchor-bytecode.ts"),
  "INTENT_ANCHOR_BYTECODE",
  "INTENT_ANCHOR_ABI"
);

generate(
  "HSKRecurringAnchor",
  path.join(__dirname, "..", "out", "HSKRecurringAnchor.sol", "HSKRecurringAnchor.json"),
  path.join(__dirname, "..", "src", "lib", "anchors", "recurring-bytecode.ts"),
  "RECURRING_BYTECODE",
  "RECURRING_ABI"
);

console.log("Done.");

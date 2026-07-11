/* eslint-disable @typescript-eslint/no-require-imports */
const solc = require("solc");
const fs = require("fs");
const path = require("path");

function findImports(importPath) {
  const base = path.join(__dirname, "..", "node_modules", importPath);
  if (fs.existsSync(base)) {
    return { contents: fs.readFileSync(base, "utf8") };
  }
  const local = path.join(__dirname, "..", importPath);
  if (fs.existsSync(local)) {
    return { contents: fs.readFileSync(local, "utf8") };
  }
  return { error: `File not found: ${importPath}` };
}

function compileContract(name, sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      [name]: { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    for (const err of output.errors) {
      if (err.severity === "error") throw new Error(err.formattedMessage);
      console.warn(err.formattedMessage);
    }
  }

  const contract = output.contracts[name]["HSKToken"] || output.contracts[name]["Multicall3"];
  if (!contract) {
    const compiledFiles = Object.keys(output.contracts);
    const contractNames = compiledFiles.flatMap(f => Object.keys(output.contracts[f]));
    throw new Error(`Contract not found in ${name}. Available: ${contractNames.join(", ")}`);
  }

  return {
    abi: contract.abi,
    bytecode: "0x" + contract.evm.bytecode.object,
  };
}

// Compile token
const token = compileContract("HSKToken", path.join(__dirname, "..", "contracts", "HSKToken.sol"));
fs.writeFileSync(
  path.join(__dirname, "..", "src", "lib", "tokens", "token-bytecode.ts"),
  `// Auto-generated — do not edit. Rebuild with: node scripts/compile-contracts.js
export const TOKEN_BYTECODE = "${token.bytecode}" as const;

export const TOKEN_ABI = ${JSON.stringify(token.abi, null, 2)} as const;
`
);
console.log(`Token: ${token.bytecode.length} bytes`);

// Compile multicall
const multicall = compileContract("Multicall3", path.join(__dirname, "..", "contracts", "Multicall3.sol"));
fs.writeFileSync(
  path.join(__dirname, "..", "src", "lib", "tokens", "multicall-bytecode.ts"),
  `// Auto-generated — do not edit. Rebuild with: node scripts/compile-contracts.js
export const MULTICALL_BYTECODE = "${multicall.bytecode}" as const;

export const MULTICALL_ABI = ${JSON.stringify(multicall.abi, null, 2)} as const;
`
);
console.log(`Multicall: ${multicall.bytecode.length} bytes`);
console.log("Done.");

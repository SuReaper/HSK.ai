// Auto-generated from Foundry artifacts. Rebuild with: forge build && node scripts/sync-abi.js
export const INTENT_ANCHOR_BYTECODE = "0x6080604052348015600e575f5ffd5b506104518061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c806334f96c8c14610043578063b01b6d531461005f578063e79cd69814610124575b5f5ffd5b61004c60015481565b6040519081526020015b60405180910390f35b6100cc61006d36600461038b565b5f60208190529081526040902080546001820154600283015460038401546004909401546001600160a01b039384169492909316926001600160801b0382169267ffffffffffffffff600160801b8404811693600160c01b9004169187565b604080516001600160a01b0398891681529790961660208801526001600160801b039094169486019490945267ffffffffffffffff918216606086015216608084015260a083019190915260c082015260e001610056565b6101376101323660046103a2565b610139565b005b8461015757604051633edae5df60e11b815260040160405180910390fd5b5f858152602081905260409020546001600160a01b03161561018c5760405163a0094ce360e01b815260040160405180910390fd5b6040518060e00160405280336001600160a01b03168152602001856001600160a01b03168152602001846001600160801b031681526020018367ffffffffffffffff1681526020014267ffffffffffffffff168152602001868152602001828152505f5f8781526020019081526020015f205f820151815f015f6101000a8154816001600160a01b0302191690836001600160a01b031602179055506020820151816001015f6101000a8154816001600160a01b0302191690836001600160a01b031602179055506040820151816002015f6101000a8154816001600160801b0302191690836001600160801b0316021790555060608201518160020160106101000a81548167ffffffffffffffff021916908367ffffffffffffffff16021790555060808201518160020160186101000a81548167ffffffffffffffff021916908367ffffffffffffffff16021790555060a0820151816003015560c0820151816004015590505060015f8154809291906001019190505550836001600160a01b0316336001600160a01b0316867fea9c5bea94eebf80ac420e49f0a12d08f599a3f0dd2332b599665ba25977f7e88686428760405161037c94939291906001600160801b0394909416845267ffffffffffffffff928316602085015291166040830152606082015260800190565b60405180910390a45050505050565b5f6020828403121561039b575f5ffd5b5035919050565b5f5f5f5f5f60a086880312156103b6575f5ffd5b8535945060208601356001600160a01b03811681146103d3575f5ffd5b935060408601356001600160801b03811681146103ee575f5ffd5b9250606086013567ffffffffffffffff8116811461040a575f5ffd5b94979396509194608001359291505056fea2646970667358221220ed869c1750277ba0a29baacabc4f357f131ea5b0ba36721715a70e4cf919336f64736f6c634300081c0033" as const;

export const INTENT_ANCHOR_ABI = [
  {
    "type": "function",
    "name": "anchorCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "anchorIntent",
    "inputs": [
      {
        "name": "intentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "chainId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "hspPaymentId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "anchors",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "author",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "chainId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "settledAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "intentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "hspPaymentId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "IntentAnchored",
    "inputs": [
      {
        "name": "intentHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "author",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "chainId",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "settledAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "hspPaymentId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyAnchored",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidIntent",
    "inputs": []
  }
] as const;

// Auto-generated from Foundry artifacts. Rebuild with: forge build && node scripts/sync-abi.js
export const RECURRING_BYTECODE = "0x6080604052348015600e575f5ffd5b506106ff8061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061004a575f3560e01c8063b7ef81e11461004e578063cca348801461006a578063d1e16bfa1461007f578063df8d4f2714610197575b5f5ffd5b61005760015481565b6040519081526020015b60405180910390f35b61007d6100783660046105c3565b6101aa565b005b61011a61008d3660046105c3565b5f60208190529081526040902080546001820154600283015460038401546004909401546001600160a01b03938416949284169391909116916001600160801b0381169160ff600160801b80840482169367ffffffffffffffff600160881b9091048116939081169263ffffffff680100000000000000008304811693600160601b84049091169204168a565b604080516001600160a01b039b8c168152998b1660208b015299909716988801989098526001600160801b03909416606087015260ff909216608086015267ffffffffffffffff90811660a08601521660c084015263ffffffff90811660e084015290921661010082015290151561012082015261014001610061565b61007d6101a5366004610608565b610248565b5f81815260208190526040902080546001600160a01b03166101df57604051631b742d9d60e31b815260040160405180910390fd5b80546001600160a01b03163314610209576040516316aac54f60e01b815260040160405180910390fd5b60048101805460ff60801b19169055604051339083907f6b3e01872ad8692cfd4a45e25ac6fc0881dad875133dd1aef8a2eddc5395edf1905f90a35050565b8661026657604051631b742d9d60e31b815260040160405180910390fd5b5f878152602081905260409020546001600160a01b03161561029b576040516302041a1b60e01b815260040160405180910390fd5b6102a742610e106106a4565b8267ffffffffffffffff1610156102d1576040516381efbd8d60e01b815260040160405180910390fd5b604051806101400160405280336001600160a01b03168152602001876001600160a01b03168152602001866001600160a01b03168152602001856001600160801b031681526020018460ff1681526020018367ffffffffffffffff1681526020015f67ffffffffffffffff1681526020015f63ffffffff1681526020018263ffffffff168152602001600115158152505f5f8981526020019081526020015f205f820151815f015f6101000a8154816001600160a01b0302191690836001600160a01b031602179055506020820151816001015f6101000a8154816001600160a01b0302191690836001600160a01b031602179055506040820151816002015f6101000a8154816001600160a01b0302191690836001600160a01b031602179055506060820151816003015f6101000a8154816001600160801b0302191690836001600160801b0316021790555060808201518160030160106101000a81548160ff021916908360ff16021790555060a08201518160030160116101000a81548167ffffffffffffffff021916908367ffffffffffffffff16021790555060c0820151816004015f6101000a81548167ffffffffffffffff021916908367ffffffffffffffff16021790555060e08201518160040160086101000a81548163ffffffff021916908363ffffffff16021790555061010082015181600401600c6101000a81548163ffffffff021916908363ffffffff1602179055506101208201518160040160106101000a81548160ff02191690831515021790555090505060015f8154809291906001019190505550336001600160a01b0316877f946bcff136e5ef604fada7fa68993ce2cc322079e518bac05071b3a27cd468098888888888886040516105b2969594939291906001600160a01b0396871681529490951660208501526001600160801b0392909216604084015260ff16606083015267ffffffffffffffff16608082015263ffffffff9190911660a082015260c00190565b60405180910390a350505050505050565b5f602082840312156105d3575f5ffd5b5035919050565b80356001600160a01b03811681146105f0575f5ffd5b919050565b803563ffffffff811681146105f0575f5ffd5b5f5f5f5f5f5f5f60e0888a03121561061e575f5ffd5b8735965061062e602089016105da565b955061063c604089016105da565b945060608801356001600160801b0381168114610657575f5ffd5b9350608088013560ff8116811461066c575f5ffd5b925060a088013567ffffffffffffffff81168114610688575f5ffd5b915061069660c089016105f5565b905092959891949750929550565b808201808211156106c357634e487b7160e01b5f52601160045260245ffd5b9291505056fea26469706673582212206a14de60d5f7403a9601a9f07bdfd1e838031890488efc45cfe06a2a9fd313e364736f6c634300081c0033" as const;

export const RECURRING_ABI = [
  {
    "type": "function",
    "name": "cancelSchedule",
    "inputs": [
      {
        "name": "scheduleId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerSchedule",
    "inputs": [
      {
        "name": "scheduleId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "cadence",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "firstFireAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "maxExecutions",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "scheduleCount",
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
    "name": "schedules",
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
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "cadence",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "nextFireAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "lastFireAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "executions",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "maxExecutions",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "active",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ScheduleCancelled",
    "inputs": [
      {
        "name": "scheduleId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "author",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ScheduleRegistered",
    "inputs": [
      {
        "name": "scheduleId",
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
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "cadence",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "nextFireAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "maxExecutions",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyScheduled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSchedule",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAuthor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PastDeadline",
    "inputs": []
  }
] as const;

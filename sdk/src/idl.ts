/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fixed_vault.json`.
 */
export type FixedVault = {
  "address": "1hV5chUTbSWcaGH76TpXq8iCFQrjKPACGF6eD68nT53",
  "metadata": {
    "name": "fixedVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Fixed-term USDC vault with rolling cap"
  },
  "instructions": [
    {
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "newAuthority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "adminWithdraw",
      "discriminator": [
        160,
        166,
        147,
        222,
        46,
        220,
        75,
        224
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "depositVault",
          "writable": true
        },
        {
          "name": "adminTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "depositVault",
          "writable": true
        },
        {
          "name": "yieldMint",
          "writable": true
        },
        {
          "name": "userYieldAccount",
          "writable": true
        },
        {
          "name": "permit",
          "docs": [
            "Optional: deposit permit (required when pool.whitelist_enabled)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "enableWithdrawals",
      "discriminator": [
        97,
        146,
        76,
        161,
        177,
        54,
        109,
        83
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "grantPermit",
      "discriminator": [
        170,
        94,
        187,
        22,
        42,
        224,
        162,
        203
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool"
        },
        {
          "name": "permit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  114,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "arg",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "pubkey"
        },
        {
          "name": "maxAmount",
          "type": "u64"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initPool",
      "discriminator": [
        116,
        233,
        199,
        204,
        115,
        159,
        171,
        36
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "depositVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "repayVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  97,
                  121,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "yieldMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  121,
                  105,
                  101,
                  108,
                  100,
                  45,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initPoolParams"
            }
          }
        }
      ]
    },
    {
      "name": "proposeAuthority",
      "discriminator": [
        20,
        148,
        236,
        198,
        76,
        119,
        99,
        142
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "repay",
      "discriminator": [
        234,
        103,
        67,
        82,
        208,
        234,
        219,
        166
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "adminTokenAccount",
          "writable": true
        },
        {
          "name": "repayVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revokePermit",
      "discriminator": [
        1,
        245,
        99,
        29,
        176,
        216,
        229,
        206
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "relations": [
            "permit"
          ]
        },
        {
          "name": "permit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  114,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "permit.user",
                "account": "depositPermit"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "sweepRepayVault",
      "discriminator": [
        193,
        28,
        190,
        50,
        16,
        108,
        22,
        7
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "repayVault",
          "writable": true
        },
        {
          "name": "adminTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "updatePool",
      "discriminator": [
        239,
        214,
        170,
        78,
        36,
        35,
        30,
        34
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updatePoolParams"
            }
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "yieldMint",
          "writable": true
        },
        {
          "name": "userYieldAccount",
          "writable": true
        },
        {
          "name": "repayVault",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "depositPermit",
      "discriminator": [
        68,
        213,
        173,
        19,
        4,
        241,
        232,
        101
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      "name": "vaultPool",
      "discriminator": [
        64,
        55,
        145,
        17,
        146,
        105,
        18,
        195
      ]
    }
  ],
  "events": [
    {
      "name": "adminWithdrawEvent",
      "discriminator": [
        209,
        205,
        149,
        148,
        126,
        161,
        184,
        237
      ]
    },
    {
      "name": "depositEvent",
      "discriminator": [
        120,
        248,
        61,
        83,
        31,
        142,
        107,
        144
      ]
    },
    {
      "name": "enableWithdrawalsEvent",
      "discriminator": [
        254,
        83,
        37,
        137,
        244,
        199,
        197,
        200
      ]
    },
    {
      "name": "repayEvent",
      "discriminator": [
        129,
        213,
        0,
        108,
        218,
        108,
        82,
        140
      ]
    },
    {
      "name": "withdrawEvent",
      "discriminator": [
        22,
        9,
        133,
        26,
        160,
        44,
        71,
        192
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "depositTooSmall",
      "msg": "Deposit amount is below the minimum"
    },
    {
      "code": 6001,
      "name": "poolCapExceeded",
      "msg": "Deposit would exceed the pool cap"
    },
    {
      "code": 6002,
      "name": "maturityNotReached",
      "msg": "Maturity date has not been reached yet"
    },
    {
      "code": 6003,
      "name": "depositDeadlinePassed",
      "msg": "Deposit deadline has passed"
    },
    {
      "code": 6004,
      "name": "capBelowActive",
      "msg": "New cap cannot be below current total active deposits"
    },
    {
      "code": 6005,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6006,
      "name": "notWhitelisted",
      "msg": "Deposit requires a valid whitelist permit"
    },
    {
      "code": 6007,
      "name": "permitExpired",
      "msg": "Deposit permit has expired"
    },
    {
      "code": 6008,
      "name": "withdrawalsNotEnabled",
      "msg": "Withdrawals are not enabled yet"
    },
    {
      "code": 6009,
      "name": "repayAfterWithdrawalsEnabled",
      "msg": "Cannot repay after withdrawals have been enabled"
    },
    {
      "code": 6010,
      "name": "unauthorized",
      "msg": "Only the protocol authority can perform this action"
    },
    {
      "code": 6011,
      "name": "adminWithdrawExceeded",
      "msg": "Admin withdraw would exceed total active deposits"
    },
    {
      "code": 6012,
      "name": "noRepayToDistribute",
      "msg": "Cannot enable withdrawals with no repay funds"
    },
    {
      "code": 6013,
      "name": "noPendingAuthority",
      "msg": "No pending authority to accept"
    },
    {
      "code": 6014,
      "name": "permitLimitExceeded",
      "msg": "Cumulative deposit would exceed permit limit"
    },
    {
      "code": 6015,
      "name": "invalidMaturity",
      "msg": "Maturity timestamp must be in the future"
    },
    {
      "code": 6016,
      "name": "decimalsTooHigh",
      "msg": "Deposit mint decimals must be <= 9"
    },
    {
      "code": 6017,
      "name": "invalidDeadlineOffset",
      "msg": "Deposit deadline offset must be less than pool duration"
    },
    {
      "code": 6018,
      "name": "withdrawalTooSmall",
      "msg": "Withdrawal amount must be greater than zero"
    },
    {
      "code": 6019,
      "name": "repayExceedsCap",
      "msg": "Repay amount would exceed total expected return"
    },
    {
      "code": 6020,
      "name": "cannotRevokeOverpay",
      "msg": "allow_overpay flag cannot be revoked once enabled"
    },
    {
      "code": 6021,
      "name": "sweepGracePeriodNotElapsed",
      "msg": "Sweep grace period (180 days post-maturity) has not elapsed"
    },
    {
      "code": 6022,
      "name": "nothingToSweep",
      "msg": "Repay vault is empty, nothing to sweep"
    },
    {
      "code": 6023,
      "name": "noRepayRemaining",
      "msg": "No repay funds remaining for withdrawal"
    },
    {
      "code": 6024,
      "name": "aprTooHigh",
      "msg": "APR exceeds maximum allowed basis points (4000 bps = 40%)"
    },
    {
      "code": 6025,
      "name": "withdrawalsAlreadyEnabled",
      "msg": "Withdrawals have already been enabled"
    }
  ],
  "types": [
    {
      "name": "adminWithdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalAdminWithdrawn",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "depositEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "yTokensMinted",
            "type": "u64"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "depositPermit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "docs": [
              "Pool this permit belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "user",
            "docs": [
              "User allowed to deposit"
            ],
            "type": "pubkey"
          },
          {
            "name": "maxAmount",
            "docs": [
              "Max cumulative deposit amount (0 = unlimited)"
            ],
            "type": "u64"
          },
          {
            "name": "amountUsed",
            "docs": [
              "Amount already deposited under this permit"
            ],
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "Permit expiry unix timestamp (0 = no expiry)"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "enableWithdrawalsEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalRepaid",
            "type": "u64"
          },
          {
            "name": "totalExpectedReturn",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "initPoolParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "aprBps",
            "type": "u16"
          },
          {
            "name": "maturityTs",
            "type": "i64"
          },
          {
            "name": "depositDeadlineOffset",
            "type": "u64"
          },
          {
            "name": "minDepositAmount",
            "type": "u64"
          },
          {
            "name": "maxTotalDeposit",
            "type": "u64"
          },
          {
            "name": "whitelistEnabled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Current protocol authority"
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingAuthority",
            "docs": [
              "Pending authority awaiting acceptance (two-step transfer)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "repayEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalRepaid",
            "type": "u64"
          },
          {
            "name": "remainingRepay",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "updatePoolParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxTotalDeposit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "minDepositAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "aprBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "allowOverpay",
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "vaultPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "docs": [
              "Pool identifier"
            ],
            "type": "u64"
          },
          {
            "name": "depositVault",
            "docs": [
              "Token account PDA for user deposits"
            ],
            "type": "pubkey"
          },
          {
            "name": "repayVault",
            "docs": [
              "Token account PDA for admin repayments"
            ],
            "type": "pubkey"
          },
          {
            "name": "depositMint",
            "docs": [
              "USDC mint address"
            ],
            "type": "pubkey"
          },
          {
            "name": "yieldMint",
            "docs": [
              "Yield token mint PDA (1 yToken = 1 USDC at maturity)"
            ],
            "type": "pubkey"
          },
          {
            "name": "aprBps",
            "docs": [
              "APR in basis points (e.g. 800 = 8%)"
            ],
            "type": "u16"
          },
          {
            "name": "maturityTs",
            "docs": [
              "Unix timestamp when deposits mature and can be withdrawn"
            ],
            "type": "i64"
          },
          {
            "name": "depositDeadlineOffset",
            "docs": [
              "Seconds before maturity_ts after which deposits are no longer accepted (0 = no restriction)"
            ],
            "type": "u64"
          },
          {
            "name": "minDepositAmount",
            "docs": [
              "Minimum deposit amount (e.g. 100_000_000 = 100 USDC)"
            ],
            "type": "u64"
          },
          {
            "name": "maxTotalDeposit",
            "docs": [
              "Maximum total active deposits (pool cap)"
            ],
            "type": "u64"
          },
          {
            "name": "totalDeposited",
            "docs": [
              "Current sum of deposited principal (never decreases)"
            ],
            "type": "u64"
          },
          {
            "name": "totalExpectedReturn",
            "docs": [
              "Total outstanding yield token liability"
            ],
            "type": "u64"
          },
          {
            "name": "totalRepaid",
            "docs": [
              "Total amount repaid by admin into repay_vault (historical, never decreases)"
            ],
            "type": "u64"
          },
          {
            "name": "remainingRepay",
            "docs": [
              "Remaining repay balance available for withdrawals (decreases on withdraw)"
            ],
            "type": "u64"
          },
          {
            "name": "totalAdminWithdrawn",
            "docs": [
              "Total amount withdrawn by admin from deposit_vault"
            ],
            "type": "u64"
          },
          {
            "name": "withdrawalsEnabled",
            "docs": [
              "Whether withdrawals are enabled (set by admin after repay)"
            ],
            "type": "bool"
          },
          {
            "name": "whitelistEnabled",
            "docs": [
              "Whether deposits require a DepositPermit"
            ],
            "type": "bool"
          },
          {
            "name": "allowOverpay",
            "docs": [
              "Allow repay amounts exceeding total_expected_return (e.g. goodwill bonus)"
            ],
            "type": "bool"
          },
          {
            "name": "totalSwept",
            "docs": [
              "Total amount swept by admin from repay_vault after grace period (orphaned funds)"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "depositVaultBump",
            "docs": [
              "Deposit vault PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "repayVaultBump",
            "docs": [
              "Repay vault PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "yieldMintBump",
            "docs": [
              "Yield mint PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "yTokensBurned",
            "type": "u64"
          },
          {
            "name": "payout",
            "type": "u64"
          },
          {
            "name": "remainingRepay",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    }
  ]
};

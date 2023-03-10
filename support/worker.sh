#/usr/bin/env bash
set -xe
export RODEO_CHAIN="42161"
export INVESTOR_ADDRESS="0x8accf43Dd31DfCd4919cc7d65912A475BfA60369"
export INVESTOR_HELPER_ADDRESS="0x6f456005A7CfBF0228Ca98358f60E6AE1d347E18"
export RODEO_API_URL="https://www.rodeofinance.xyz"
export RODEO_RPC_URL=""
export RODEO_PRIVATE_KEY=""
export DATABASE_URL=""
./worker

CHAIN_ID := 421611
RPC_URL := https://rinkeby.arbitrum.io/rpc
CHAIN_ID_MAINNET := 42161
RPC_URL_MAINNET := https://arb1.arbitrum.io/rpc

test:
	forge test -vvv

build:
	forge build -vvv

clean:
	rm -rf broadcast out cache

fmt:
	find src/**/*.sol | xargs -n 1 -t forge fmt

node:
	anvil --chain-id 1337 # -b 2

initcodehash:
	forge script src/scripts/UniV2InitcodeHash.s.sol:UniV2InitcodeHash

poolinfo:
	forge script src/scripts/PoolInfo.s.sol:PoolInfo \
		-vvvv --fork-url $(RPC_URL_MAINNET)

call:
	cast call --rpc-url=$(RPC_URL_MAINNET) 0x9D6A853Da8BF51386240Ad1ed19E13C48dF3a2A7 "originationFee() returns (uint256)"

debug:
	forge script src/scripts/Debug.s.sol:Debug \
		-vvvv --fork-url $(RPC_URL_MAINNET)

debug-local:
	forge script src/scripts/Debug.s.sol:Debug \
		-vvvv --fork-url http://localhost:8545

deploy-local:
	forge script src/scripts/DeployAll.s.sol:DeployAll \
		--rpc-url http://localhost:8545  \
		--private-key ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast -vvvv

deploy-liq-test:
	forge script src/scripts/DeployLiqTest.s.sol:DeployLiqTest \
		--rpc-url http://localhost:8545  \
		--private-key ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast -vvvv

deploy-single:
	forge script src/scripts/DeploySingle.s.sol:DeploySingle \
		--rpc-url $(RPC_URL)  \
		--private-key $(RODEO_PRIVATE_KEY_TESTNET) \
		--broadcast --verify -vvvv \
		--etherscan-api-key $(RODEO_ETHERSCAN_KEY)

deploy:
	forge script src/scripts/DeploySingle.s.sol:DeploySingle \
		--rpc-url $(RPC_URL_MAINNET)  \
		--private-key $(RODEO_PRIVATE_KEY_MAINNET) \
		--broadcast --verify -vvvv \
		--etherscan-api-key $(RODEO_ETHERSCAN_KEY)

deploy-liquidation-helper:
	forge create \
		--rpc-url $(RPC_URL_MAINNET)  \
		--private-key $(RODEO_PRIVATE_KEY_MAINNET) \
		--etherscan-api-key $(RODEO_ETHERSCAN_KEY) \
		--verify \
		src/LiquidationHelper.sol:LiquidationHelper

deploy-univ3:
	forge create \
		--rpc-url $(RPC_URL_MAINNET)  \
		--private-key $(RODEO_PRIVATE_KEY_MAINNET) \
		--etherscan-api-key $(RODEO_ETHERSCAN_KEY) \
		--verify \
		src/StrategyUniswapV3.sol:StrategyUniswapV3 \
		--constructor-args \
		  "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" \
		  "0x2105b54C400d8D95E1528285C07B908E0084fc43" \
		  "UniV3 ETH/USDC 0.05" \
		  "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443" \
			"500" \
		  "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" \
		  "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3" \
			"0xE592427A0AEce92De3Edee1F18E0157C05861564" \
			"0x" \
			"0x"

deploy-add-strategy:
	cast send \
		--rpc-url $(RPC_URL_MAINNET)  \
		--private-key $(RODEO_PRIVATE_KEY_MAINNET) \
		0x2105b54C400d8D95E1528285C07B908E0084fc43 "function file(bytes32,address)" \
			$(shell cast --from-utf8 strategies) "0x4C648dE9B166C5040C5f521f50433AeCF91261b3"

# ~/.svm/0.8.15/solc-0.8.15 --version
verify:
	forge verify-contract \
		--chain-id $(CHAIN_ID_MAINNET) --num-of-optimizations 200 \
		--compiler-version 0.8.17+commit.8df45f5f \
		--constructor-args $(shell cast abi-encode "constructor(address)" "0x8accf43Dd31DfCd4919cc7d65912A475BfA60369") \
		0x9D6A853Da8BF51386240Ad1ed19E13C48dF3a2A7 \
		src/InvestorActor.sol:InvestorActor $(RODEO_ETHERSCAN_KEY)

deploy-token:
	forge script src/scripts/DeployToken.s.sol:DeployToken \
		--rpc-url $(RPC_URL)  \
		--private-key $(RODEO_PRIVATE_KEY_TESTNET) \
		--broadcast --verify -vvvv \
		--etherscan-api-key $(RODEO_ETHERSCAN_KEY)

verify-token:
	forge verify-contract \
		--chain-id $(CHAIN_ID) --num-of-optimizations 20000 \
		--compiler-version v0.8.15+commit.e14f2714 \
		--constructor-args $(shell cast abi-encode "constructor()") \
		0xd05c162c7a9c58844db3232d57d522616d81e1b4 \
		src/scripts/DeployToken.s.sol:DeployToken $(RODEO_ETHERSCAN_KEY)

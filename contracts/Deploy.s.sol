// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "./LinkyEscrow.sol";

// Foundry deploy script.
//
// Usage (Base Sepolia):
//   forge script Deploy --rpc-url https://sepolia.base.org \
//     --private-key $PRIVATE_KEY --broadcast --verify
//
// Env required:
//   USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia)
//   TREASURY=0x... your treasury wallet
//   FEE_BPS=500
//   REFUND_DELAY=604800   // 7 days
contract Deploy is Script {
    function run() external returns (address) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY");
        uint256 feeBps = vm.envUint("FEE_BPS");
        uint256 refundDelay = vm.envUint("REFUND_DELAY");

        vm.startBroadcast();
        LinkyEscrow escrow = new LinkyEscrow(usdc, treasury, feeBps, refundDelay);
        vm.stopBroadcast();

        console.log("LinkyEscrow deployed at:", address(escrow));
        return address(escrow);
    }
}

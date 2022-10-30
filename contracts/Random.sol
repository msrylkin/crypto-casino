// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.9 <0.9.0;

import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/ConfirmedOwner.sol';

contract Random is VRFConsumerBaseV2, ConfirmedOwner {
    bytes32 keyHash;
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    uint32 gasLimit;
    uint256[] public randomWords;

    mapping (uint256 => address) public callbacks;

    constructor(
        uint64 subscriptionId,
        bytes32 _keyhash,
        address _vrfCoordinator,
        uint32 _gasLimit
    )
        VRFConsumerBaseV2(_vrfCoordinator)
        ConfirmedOwner(msg.sender)
    {
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        s_subscriptionId = subscriptionId;
        keyHash = _keyhash;
        gasLimit = _gasLimit;
    }

    function requestRandomWords(address callbackAddress) external onlyOwner returns (uint256 requestId) {
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            3,
            gasLimit,
            1
        );
        callbacks[requestId] = callbackAddress;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory _randomWords) internal override {
        randomWords = _randomWords;
        (bool success, ) = callbacks[requestId].call(abi.encodeWithSignature("receiveRandom(uint256,uint256)", requestId, _randomWords[0]));
        require(success, 'cant return random');
    }
}
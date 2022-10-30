// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
import './Random.sol';

// for test purposes
contract Caller {
    Random random;

    constructor(Random _c) {
        random = _c;
    }

    function request() external {
        random.requestRandomWords(address(this));
    }

    function receiveRandom(uint256 requestId, uint256 _randomWord) external {
        // noop
    }
}
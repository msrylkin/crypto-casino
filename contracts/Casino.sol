// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.9 <0.9.0;

import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/ConfirmedOwner.sol';
import "./Random.sol";

uint256 constant MAX_BET = type(uint256).max / 11;

contract Casino {
    struct Player {
        address playerId;
        uint256 amount;
    }
    bytes32[] public currentPlayerKeyHashes;
    mapping(bytes32 => Player) public players;
    uint public currentGameNumber;
    mapping (uint256 => address) public winners;
    uint256 public handledRequestId;
    bool public rollInProgress;
    address owner;
    Random randomGenerator;

    constructor(Random _randomGenerator) {
        randomGenerator = _randomGenerator;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'only owner can call this function');
        _;
    }

    function bet() public payable {
        require(msg.value >= 0.00001 ether && msg.value <= 0.1 ether, 'ETH amount must be between 0.00001 and 0.1');
        require(!rollInProgress, 'roll in progress');

        bytes32 key = keccak256(abi.encode(currentGameNumber, msg.sender));
        require(players[key].amount + msg.value < MAX_BET, 'very high bet');

        if (players[key].amount == 0) {
            players[key].playerId = msg.sender;
            currentPlayerKeyHashes.push(key);
        }
        players[key].amount += msg.value;
    }

    function getBalance() public view returns(uint) {
        return address(this).balance;
    }

    function performGame() external onlyOwner {
        chooseWinner();
    }

    function chooseWinner() internal {
        require(currentPlayerKeyHashes.length > 5, 'must be more than 5 players');
        randomGenerator.requestRandomWords(address(this));
        rollInProgress = true;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function chooseWinner(uint256 randomWord) internal {
        uint256 totalSum = 0;
        for (uint256 i = 0; i < currentPlayerKeyHashes.length; i++) {
            totalSum += players[currentPlayerKeyHashes[i]].amount;
        }

        uint256 normalizedRandomNumber = randomWord % 100;

        for (uint256 i = 0; i < currentPlayerKeyHashes.length; i++) {
            bytes32 playerKeyHash = currentPlayerKeyHashes[i];
            uint256 weight = max((players[playerKeyHash].amount * 100) / totalSum, 1);

            if (normalizedRandomNumber <= weight) {
                delete currentPlayerKeyHashes;
                payable(players[playerKeyHash].playerId).transfer(address(this).balance);
                rollInProgress = false;
                winners[currentGameNumber] = players[playerKeyHash].playerId;
                currentGameNumber++;
                return;
            }

            normalizedRandomNumber -= weight;
        }

        // should never get there
        revert('Internal error');
    }

    function receiveRandom(uint256, uint256 _randomWord) external {
        chooseWinner(_randomWord);
    }
}

import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import * as chai from "chai";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { Contract } from "ethers";
import { Caller } from "../typechain-types/contracts/Caller";
import { Random, VRFConsumerBaseV2__factory, VRFConsumerBaseV2, VRFCoordinatorV2Interface } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const vRFCoordinatorV2InterfaceABI = require('../artifacts/@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol/VRFCoordinatorV2Interface.json').abi;

chai.use(smock.matchers);

describe(__filename, () => {
    let owner: SignerWithAddress;
    let random: Random;
    let caller: FakeContract<Caller>;
    let vrfCoordinator: FakeContract<VRFCoordinatorV2Interface>;

    beforeEach(async () => {
        vrfCoordinator = await smock.fake(vRFCoordinatorV2InterfaceABI);
        await vrfCoordinator.deployed();
        
        ([owner] = await ethers.getSigners());
        const Random = await ethers.getContractFactory("Random", owner);
        random = await Random.deploy(
            1,
            ethers.utils.formatBytes32String('1'),
            vrfCoordinator.address,
            2
        );
        await random.deployed();

        caller = await smock.fake('Caller');
    });

    it('should request random words and remember callback', async () => {
        const requestId = 333;
        vrfCoordinator.requestRandomWords.returns(requestId);

        await random.requestRandomWords(caller.address);

        expect(vrfCoordinator.requestRandomWords).to.have.been.calledOnce;
        expect(await random.callbacks(requestId)).to.be.eq(caller.address);
    });

    it('should fullfill words', async () => {
        const requestId = 333;
        vrfCoordinator.requestRandomWords.returns(requestId);
        await owner.sendTransaction({
            to: vrfCoordinator.address,
            value: ethers.utils.parseEther('1.0'),
        });

        await random.requestRandomWords(caller.address);

        expect(vrfCoordinator.requestRandomWords).to.have.been.calledOnce;
        expect(await random.callbacks(requestId)).to.be.eq(caller.address);

        const randomNumber = 1;
        await random.connect(vrfCoordinator.wallet).rawFulfillRandomWords(requestId, [randomNumber]);

        expect(caller.receiveRandom).to.be.calledOnce;
        expect(caller.receiveRandom).to.be.calledWith(requestId, randomNumber);
    });
});

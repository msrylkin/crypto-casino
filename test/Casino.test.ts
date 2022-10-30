import * as chai from "chai";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from '@defi-wonderland/smock';
import { Random } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Casino } from "../typechain-types/contracts/Casino";

chai.use(smock.matchers);

describe(__filename, () => {
    let owner: SignerWithAddress;
    let casino!: Casino;
    let random: FakeContract<Random>

    beforeEach(async () => {
        random = await smock.fake('Random');
        await random.deployed();

        ([owner] = await ethers.getSigners());
        const Casino = await ethers.getContractFactory("Casino", owner);

        casino = await Casino.deploy(random.address);
        await casino.deployed();
    });

    it('should make bet and show balance', async () => {
        const betAmount = ethers.utils.parseEther('0.0001');
        await casino.connect(owner).bet({ value: betAmount });

        const balance = await casino.getBalance();
        
        expect(balance).to.be.eq(betAmount);
    });

    it('should start game at admin call', async () => {
        const signers = await ethers.getSigners();

        for (let i = 0; i < signers.length && i <= 5; i++) {
            await casino.connect(signers[i]).bet({ value: ethers.utils.parseEther('0.0001') });
        }
        await casino.performGame();

        expect(random.requestRandomWords).to.be.calledOnce;
        expect(random.requestRandomWords).to.be.calledWith(casino.address);
        expect(await casino.rollInProgress()).to.be.true;
    });

    it('should revert if called not by owner', async () => {
        const signers = await ethers.getSigners();

        for (let i = 0; i < signers.length && i <= 5; i++) {
            await casino.connect(signers[i]).bet({ value: ethers.utils.parseEther('0.0001') });
        }

        await expect(casino.connect(signers[signers.length - 1]).performGame()).to.be.revertedWith('only owner can call this function');
        expect(random.requestRandomWords).to.not.be.called;
    });

    it('should revert if players not enough', async () => {
        const signers = await ethers.getSigners();

        for (let i = 0; i < signers.length && i < 5; i++) {
            await casino.connect(signers[i]).bet({ value: ethers.utils.parseEther('0.0001') });
        }

        await expect(casino.performGame()).to.be.revertedWith('must be more than 5 players');
        expect(random.requestRandomWords).to.not.be.called;
    });

    it('should revert new bet while game in progress', async () => {
        const signers = await ethers.getSigners();

        for (let i = 0; i < signers.length && i <= 5; i++) {
            await casino.connect(signers[i]).bet({ value: ethers.utils.parseEther('0.0001') });
        }
        await casino.performGame();

        expect(random.requestRandomWords).to.be.calledOnce;
        expect(random.requestRandomWords).to.be.calledWith(casino.address);
        expect(await casino.rollInProgress()).to.be.true;

        await expect(casino.connect(signers[signers.length - 1]).bet({ value: ethers.utils.parseEther('0.0001')})).to.be.revertedWith('roll in progress');
    });

    it('should revert new bet if amount is not in range', async () => {
        const [signer1, signer2] = await ethers.getSigners();

        await expect(casino.connect(signer1).bet({ value: 1 })).to.be.rejectedWith('ETH amount must be between 0.00001 and 0.1');
        await expect(casino.connect(signer2).bet({ value: ethers.utils.parseEther('1.0') })).to.be.rejectedWith('ETH amount must be between 0.00001 and 0.1');
    });

    it('should choose winner at recieve word', async () => {
        const [,player1,player2,player3] = await ethers.getSigners();
        await casino.connect(player1).bet({
            value: ethers.utils.parseEther('0.0001'),
        }); // 9% chance
        await casino.connect(player2).bet({
            value: ethers.utils.parseEther('0.00001'),
        }); // 1% chance 
        await casino.connect(player3).bet({
            value: ethers.utils.parseEther('0.001'),
        }); // 90% chance

        const gameTx = await casino.receiveRandom(1, 123);

        await expect(gameTx).to.changeEtherBalance(player3, ethers.utils.parseEther('0.00111'));
        await expect(gameTx).to.changeEtherBalance(casino, ethers.utils.parseEther('-0.00111'));
        await expect(await casino.getBalance()).to.eq(0);
        expect(await casino.winners(0)).to.be.eq(player3.address);
    });
});
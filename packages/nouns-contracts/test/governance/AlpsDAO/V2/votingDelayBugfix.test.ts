import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import {
  deployAlpsToken,
  getSigners,
  TestSigners,
  setTotalSupply,
  advanceBlocks,
  deployGovernorV1,
  deployGovernorV2AndSetQuorumParams,
  propose,
  populateDescriptorV2,
} from '../../../utils';
import { mineBlock } from '../../../utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  AlpsToken,
  AlpsDescriptorV2__factory as AlpsDescriptorV2Factory,
  AlpsDAOLogicV1,
  AlpsDAOLogicV1__factory as AlpsDaoLogicV1Factory,
  AlpsDAOLogicV2,
  AlpsDAOLogicV2__factory as AlpsDaoLogicV2Factory,
} from '../../../../typechain';

chai.use(solidity);
const { expect } = chai;

const V1_QUORUM_BPS = 100;

let token: AlpsToken;
let deployer: SignerWithAddress;
let account0: SignerWithAddress;
let account1: SignerWithAddress;
let signers: TestSigners;

let govProxyAddress: string;
let govV1: AlpsDAOLogicV1;
let govV2: AlpsDAOLogicV2;

async function setupWithV1() {
  token = await deployAlpsToken(signers.deployer);

  await populateDescriptorV2(
    AlpsDescriptorV2Factory.connect(await token.descriptor(), signers.deployer),
  );

  await setTotalSupply(token, 100);

  ({ address: govProxyAddress } = await deployGovernorV1(deployer, token.address, V1_QUORUM_BPS));
}

async function createPropEditVotingDelayFlow(
  gov: AlpsDAOLogicV1 | AlpsDAOLogicV2,
  user: SignerWithAddress,
  tokenId: number,
) {
  await gov._setVotingDelay(1);
  await advanceBlocks(10);
  await token.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

  await propose(gov, user);
  await mineBlock();

  await gov._setVotingDelay(10);
  return await gov.latestProposalIds(user.address);
}

describe('AlpsDAOV2 votingDelay bugfix', () => {
  before(async () => {
    signers = await getSigners();
    deployer = signers.deployer;
    account0 = signers.account0;
    account1 = signers.account1;

    await setupWithV1();

    govV1 = AlpsDaoLogicV1Factory.connect(govProxyAddress, deployer);
    govV2 = AlpsDaoLogicV2Factory.connect(govProxyAddress, deployer);
  });

  it('Simulate the bug in V1', async () => {
    const propId = await createPropEditVotingDelayFlow(govV1, account0, 0);
    let prop = await govV1.proposals(propId);
    expect(prop.forVotes).to.equal(0);

    await govV1.connect(account0).castVote(propId, 1);

    prop = await govV1.proposals(propId);
    expect(prop.forVotes).to.equal(0);
  });

  it('and upgrade to V2', async () => {
    await deployGovernorV2AndSetQuorumParams(deployer, govProxyAddress);
  });

  it('and V2 fixes the bug', async () => {
    const propId = await createPropEditVotingDelayFlow(govV2, account1, 1);
    let prop = await govV2.proposals(propId);
    expect(prop.forVotes).to.equal(0);

    await govV2.connect(account1).castVote(propId, 1);

    prop = await govV2.proposals(propId);
    expect(prop.forVotes).to.equal(1);
  });
});

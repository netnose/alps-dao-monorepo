import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  AlpsDescriptor,
  AlpsDescriptor__factory as AlpsDescriptorFactory,
  AlpsDescriptorV2,
  AlpsDescriptorV2__factory as AlpsDescriptorV2Factory,
  AlpsToken,
  AlpsToken__factory as AlpsTokenFactory,
  AlpsSeeder,
  AlpsSeeder__factory as AlpsSeederFactory,
  WETH,
  WETH__factory as WethFactory,
  AlpsDAOLogicV1,
  AlpsDAOLogicV1Harness__factory as AlpsDaoLogicV1HarnessFactory,
  AlpsDAOLogicV2,
  AlpsDAOLogicV2__factory as AlpsDaoLogicV2Factory,
  AlpsDAOProxy__factory as AlpsDaoProxyFactory,
  AlpsDAOLogicV1Harness,
  AlpsDAOProxyV2__factory as AlpsDaoProxyV2Factory,
  AlpsArt__factory as AlpsArtFactory,
  SVGRenderer__factory as SVGRendererFactory,
  AlpsDAOExecutor__factory as AlpsDaoExecutorFactory,
  AlpsDAOLogicV1__factory as AlpsDaoLogicV1Factory,
  AlpsAttribute__factory as AlpsAttributeFactory,
  AlpsDAOExecutor,
  Inflator__factory,
  AlpsDAOStorageV2,
  AlpsAttribute,
} from '../typechain';
import ImageData from '../files/image-data-v1.json';
import ImageDataV2 from '../files/image-data-v2.json';
import { Block } from '@ethersproject/abstract-provider';
import { deflateRawSync } from 'zlib';
import { chunkArray } from '../utils';
import { MAX_QUORUM_VOTES_BPS, MIN_QUORUM_VOTES_BPS } from './constants';
import { DynamicQuorumParams } from './types';
import { BigNumber } from 'ethers';

export type TestSigners = {
  deployer: SignerWithAddress;
  account0: SignerWithAddress;
  account1: SignerWithAddress;
  account2: SignerWithAddress;
};

export const getSigners = async (): Promise<TestSigners> => {
  const [deployer, account0, account1, account2] = await ethers.getSigners();
  return {
    deployer,
    account0,
    account1,
    account2,
  };
};

export const deployAlpsDescriptor = async (
  deployer?: SignerWithAddress,
): Promise<AlpsDescriptor> => {
  const signer = deployer || (await getSigners()).deployer;
  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor', signer);
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy();
  const alpsDescriptorFactory = new AlpsDescriptorFactory(
    {
      'contracts/libs/NFTDescriptor.sol:NFTDescriptor': nftDescriptorLibrary.address,
    },
    signer,
  );

  return alpsDescriptorFactory.deploy();
};

export const deployAlpsDescriptorV2 = async (deployer?: SignerWithAddress) => {
  const signer = deployer || (await getSigners()).deployer;
  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptorV2', signer);
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy();
  const alpsDescriptorFactory = new AlpsDescriptorV2Factory(
    {
      'contracts/libs/NFTDescriptorV2.sol:NFTDescriptorV2': nftDescriptorLibrary.address,
    },
    signer,
  );

  const renderer = await new SVGRendererFactory(signer).deploy();
  const attribute = await new AlpsAttributeFactory(signer).deploy();
  const descriptor = await alpsDescriptorFactory.deploy(
    ethers.constants.AddressZero,
    renderer.address,
    attribute.address,
  );

  const inflator = await new Inflator__factory(signer).deploy();

  const art = await new AlpsArtFactory(signer).deploy(descriptor.address, inflator.address);
  await descriptor.setArt(art.address);

  return { descriptor, attribute };
};

export const deployAlpsSeeder = async (deployer?: SignerWithAddress): Promise<AlpsSeeder> => {
  const factory = new AlpsSeederFactory(deployer || (await getSigners()).deployer);

  return factory.deploy();
};

export const deployAlpsToken = async (
  deployer?: SignerWithAddress,
  alpersDAO?: string,
  minter?: string,
  descriptor?: string,
  seeder?: string,
  proxyRegistryAddress?: string,
): Promise<AlpsToken> => {
  const signer = deployer || (await getSigners()).deployer;
  const factory = new AlpsTokenFactory(signer);

  return factory.deploy(
    alpersDAO || signer.address,
    minter || signer.address,
    descriptor || (await deployAlpsDescriptorV2(signer)).descriptor.address,
    seeder || (await deployAlpsSeeder(signer)).address,
    proxyRegistryAddress || address(0),
  );
};

export const deployWeth = async (deployer?: SignerWithAddress): Promise<WETH> => {
  const factory = new WethFactory(deployer || (await getSigners()).deployer);

  return factory.deploy();
};

export const populateDescriptor = async (alpsDescriptor: AlpsDescriptor): Promise<void> => {
  const { bgcolors, palette, images } = ImageData;
  const { bodies, accessories, heads, glasses } = images;

  // Split up head and accessory population due to high gas usage
  await Promise.all([
    alpsDescriptor.addManyBackgrounds(bgcolors),
    alpsDescriptor.addManyColorsToPalette(0, palette),
    alpsDescriptor.addManyBodies(bodies.map(({ data }) => data)),
    chunkArray(accessories, 10).map(chunk =>
      alpsDescriptor.addManyAccessories(chunk.map(({ data }) => data)),
    ),
    chunkArray(heads, 10).map(chunk => alpsDescriptor.addManyHeads(chunk.map(({ data }) => data))),
    alpsDescriptor.addManyGlasses(glasses.map(({ data }) => data)),
  ]);
};

export const populateAttribute = async (alpsAttribute: AlpsAttribute): Promise<void> => {
  const { images } = ImageDataV2;
  const { bodies, accessories, heads, glasses } = images;

  const bodyAttributes = bodies.map(({ filename }) => parseTraitName(filename));
  const accessoryAttributes = accessories.map(({ filename }) => parseTraitName(filename));
  const headAttributes = heads.map(({ filename }) => parseTraitName(filename));
  const glassesAttributes = glasses.map(({ filename }) => parseTraitName(filename));

  await alpsAttribute.addManyBackgrounds([
    'Bluebird Sky',
    'Evergreen',
    'Night',
    'Slate',
    'Yellow Snow',
    'Cool',
    'Warm',
  ]);

  await alpsAttribute.addManyBodies(bodyAttributes);
  await alpsAttribute.addManyAccessories(accessoryAttributes);
  await alpsAttribute.addManyHeads(headAttributes);
  await alpsAttribute.addManyGlasses(glassesAttributes);
};

export const populateDescriptorV2 = async (alpsDescriptor: AlpsDescriptorV2): Promise<void> => {
  const { bgcolors, palette, images } = ImageDataV2;
  const { bodies, accessories, heads, glasses } = images;

  const {
    encodedCompressed: bodiesCompressed,
    originalLength: bodiesLength,
    itemCount: bodiesCount,
  } = dataToDescriptorInput(bodies.map(({ data }) => data));
  const {
    encodedCompressed: accessoriesCompressed,
    originalLength: accessoriesLength,
    itemCount: accessoriesCount,
  } = dataToDescriptorInput(accessories.map(({ data }) => data));
  const {
    encodedCompressed: headsCompressed,
    originalLength: headsLength,
    itemCount: headsCount,
  } = dataToDescriptorInput(heads.map(({ data }) => data));
  const {
    encodedCompressed: glassesCompressed,
    originalLength: glassesLength,
    itemCount: glassesCount,
  } = dataToDescriptorInput(glasses.map(({ data }) => data));

  await alpsDescriptor.addManyBackgrounds(bgcolors);
  await alpsDescriptor.setPalette(0, `0x000000${palette.join('')}`);
  await alpsDescriptor.addBodies(bodiesCompressed, bodiesLength, bodiesCount);
  await alpsDescriptor.addAccessories(accessoriesCompressed, accessoriesLength, accessoriesCount);
  await alpsDescriptor.addHeads(headsCompressed, headsLength, headsCount);
  await alpsDescriptor.addGlasses(glassesCompressed, glassesLength, glassesCount);
};

export const deployGovAndToken = async (
  deployer: SignerWithAddress,
  timelockDelay: number,
  proposalThresholdBPS: number,
  quorumVotesBPS: number,
  vetoer?: string,
): Promise<{ token: AlpsToken; gov: AlpsDAOLogicV1; timelock: AlpsDAOExecutor }> => {
  // nonce 0: Deploy AlpsDAOExecutor
  // nonce 1: Deploy AlpsDAOLogicV1
  // nonce 2: Deploy nftDescriptorLibraryFactory
  // nonce 3: Deploy SVGRenderer
  // nonce 4: Deploy AlpsDescriptor
  // nonce 5: Deploy Inflator
  // nonce 6: Deploy AlpsArt
  // nonce 7: AlpsDescriptor.setArt
  // nonce 8: Deploy AlpsSeeder
  // nonce 9: Deploy AlpsToken
  // nonce 10: Deploy AlpsDAOProxy
  // nonce 11+: populate Descriptor

  const govDelegatorAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: (await deployer.getTransactionCount()) + 10,
  });

  // Deploy AlpsDAOExecutor with pre-computed Delegator address
  const timelock = await new AlpsDaoExecutorFactory(deployer).deploy(
    govDelegatorAddress,
    timelockDelay,
  );

  // Deploy Delegate
  const { address: govDelegateAddress } = await new AlpsDaoLogicV1Factory(deployer).deploy();
  // Deploy Alps token
  const token = await deployAlpsToken(deployer);

  // Deploy Delegator
  await new AlpsDaoProxyFactory(deployer).deploy(
    timelock.address,
    token.address,
    vetoer || address(0),
    timelock.address,
    govDelegateAddress,
    5760,
    1,
    proposalThresholdBPS,
    quorumVotesBPS,
  );

  // Cast Delegator as Delegate
  const gov = AlpsDaoLogicV1Factory.connect(govDelegatorAddress, deployer);

  await populateDescriptorV2(AlpsDescriptorV2Factory.connect(await token.descriptor(), deployer));

  return { token, gov, timelock };
};

export const deployGovV2AndToken = async (
  deployer: SignerWithAddress,
  timelockDelay: number,
  proposalThresholdBPS: number,
  quorumParams: AlpsDAOStorageV2.DynamicQuorumParamsStruct,
  vetoer?: string,
): Promise<{ token: AlpsToken; gov: AlpsDAOLogicV2; timelock: AlpsDAOExecutor }> => {
  const govDelegatorAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: (await deployer.getTransactionCount()) + 10,
  });

  // Deploy AlpsDAOExecutor with pre-computed Delegator address
  const timelock = await new AlpsDaoExecutorFactory(deployer).deploy(
    govDelegatorAddress,
    timelockDelay,
  );

  // Deploy Delegate
  const { address: govDelegateAddress } = await new AlpsDaoLogicV2Factory(deployer).deploy();
  // Deploy Alps token
  const token = await deployAlpsToken(deployer);

  // Deploy Delegator
  await new AlpsDaoProxyV2Factory(deployer).deploy(
    timelock.address,
    token.address,
    vetoer || address(0),
    timelock.address,
    govDelegateAddress,
    5760,
    1,
    proposalThresholdBPS,
    quorumParams,
  );

  // Cast Delegator as Delegate
  const gov = AlpsDaoLogicV2Factory.connect(govDelegatorAddress, deployer);

  await populateDescriptorV2(AlpsDescriptorV2Factory.connect(await token.descriptor(), deployer));

  return { token, gov, timelock };
};

/**
 * Return a function used to mint `amount` Alps on the provided `token`
 * @param token The Alps ERC721 token
 * @param amount The number of Alps to mint
 */
export const MintAlps = (
  token: AlpsToken,
  burnAlpersTokens = true,
): ((amount: number) => Promise<void>) => {
  return async (amount: number): Promise<void> => {
    for (let i = 0; i < amount; i++) {
      await token.mint();
    }
    if (!burnAlpersTokens) return;

    await setTotalSupply(token, amount);
  };
};

/**
 * Mints or burns tokens to target a total supply. Due to Alpers' rewards tokens may be burned and tokenIds will not be sequential
 */
export const setTotalSupply = async (token: AlpsToken, newTotalSupply: number): Promise<void> => {
  const totalSupply = (await token.totalSupply()).toNumber();

  if (totalSupply < newTotalSupply) {
    for (let i = 0; i < newTotalSupply - totalSupply; i++) {
      await token.mint();
    }
    // If Alper's reward tokens were minted totalSupply will be more than expected, so run setTotalSupply again to burn extra tokens
    await setTotalSupply(token, newTotalSupply);
  }

  if (totalSupply > newTotalSupply) {
    for (let i = newTotalSupply; i < totalSupply; i++) {
      await token.burn(i);
    }
  }
};

// The following adapted from `https://github.com/compound-finance/compound-protocol/blob/master/tests/Utils/Ethereum.js`

const rpc = <T = unknown>({
  method,
  params,
}: {
  method: string;
  params?: unknown[];
}): Promise<T> => {
  return network.provider.send(method, params);
};

export const encodeParameters = (types: string[], values: unknown[]): string => {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
};

export const blockByNumber = async (n: number | string): Promise<Block> => {
  return rpc({ method: 'eth_getBlockByNumber', params: [n, false] });
};

export const increaseTime = async (seconds: number): Promise<unknown> => {
  await rpc({ method: 'evm_increaseTime', params: [seconds] });
  return rpc({ method: 'evm_mine' });
};

export const freezeTime = async (seconds: number): Promise<unknown> => {
  await rpc({ method: 'evm_increaseTime', params: [-1 * seconds] });
  return rpc({ method: 'evm_mine' });
};

export const advanceBlocks = async (blocks: number): Promise<void> => {
  for (let i = 0; i < blocks; i++) {
    await mineBlock();
  }
};

export const blockNumber = async (parse = true): Promise<number> => {
  const result = await rpc<number>({ method: 'eth_blockNumber' });
  return parse ? parseInt(result.toString()) : result;
};

export const blockTimestamp = async (
  n: number | string,
  parse = true,
): Promise<number | string> => {
  const block = await blockByNumber(n);
  return parse ? parseInt(block.timestamp.toString()) : block.timestamp;
};

export const setNextBlockBaseFee = async (value: BigNumber): Promise<void> => {
  await network.provider.send('hardhat_setNextBlockBaseFeePerGas', [value.toHexString()]);
};

export const setNextBlockTimestamp = async (n: number, mine = true): Promise<void> => {
  await rpc({ method: 'evm_setNextBlockTimestamp', params: [n] });
  if (mine) await mineBlock();
};

export const minerStop = async (): Promise<void> => {
  await network.provider.send('evm_setAutomine', [false]);
  await network.provider.send('evm_setIntervalMining', [0]);
};

export const minerStart = async (): Promise<void> => {
  await network.provider.send('evm_setAutomine', [true]);
};

export const mineBlock = async (): Promise<void> => {
  await network.provider.send('evm_mine');
};

export const chainId = async (): Promise<number> => {
  return parseInt(await network.provider.send('eth_chainId'), 16);
};

export const address = (n: number): string => {
  return `0x${n.toString(16).padStart(40, '0')}`;
};

export const propStateToString = (stateInt: number): string => {
  const states: string[] = [
    'Pending',
    'Active',
    'Canceled',
    'Defeated',
    'Succeeded',
    'Queued',
    'Expired',
    'Executed',
    'Vetoed',
  ];
  return states[stateInt];
};

export const deployGovernorV1 = async (
  deployer: SignerWithAddress,
  tokenAddress: string,
  quorumVotesBPs: number = MIN_QUORUM_VOTES_BPS,
): Promise<AlpsDAOLogicV1Harness> => {
  const { address: govDelegateAddress } = await new AlpsDaoLogicV1HarnessFactory(deployer).deploy();
  const params: Parameters<AlpsDaoProxyFactory['deploy']> = [
    address(0),
    tokenAddress,
    deployer.address,
    deployer.address,
    govDelegateAddress,
    1728,
    1,
    1,
    quorumVotesBPs,
  ];

  const { address: _govDelegatorAddress } = await (
    await ethers.getContractFactory('AlpsDAOProxy', deployer)
  ).deploy(...params);

  return AlpsDaoLogicV1HarnessFactory.connect(_govDelegatorAddress, deployer);
};

export const deployGovernorV2WithV2Proxy = async (
  deployer: SignerWithAddress,
  tokenAddress: string,
  timelockAddress?: string,
  vetoerAddress?: string,
  votingPeriod?: number,
  votingDelay?: number,
  proposalThresholdBPs?: number,
  dynamicQuorumParams?: DynamicQuorumParams,
): Promise<AlpsDAOLogicV2> => {
  const v2LogicContract = await new AlpsDaoLogicV2Factory(deployer).deploy();

  const proxy = await new AlpsDaoProxyV2Factory(deployer).deploy(
    timelockAddress || deployer.address,
    tokenAddress,
    vetoerAddress || deployer.address,
    deployer.address,
    v2LogicContract.address,
    votingPeriod || 5760,
    votingDelay || 1,
    proposalThresholdBPs || 1,
    dynamicQuorumParams || {
      minQuorumVotesBPS: MIN_QUORUM_VOTES_BPS,
      maxQuorumVotesBPS: MAX_QUORUM_VOTES_BPS,
      quorumCoefficient: 0,
    },
  );

  return AlpsDaoLogicV2Factory.connect(proxy.address, deployer);
};

export const deployGovernorV2 = async (
  deployer: SignerWithAddress,
  proxyAddress: string,
): Promise<AlpsDAOLogicV2> => {
  const v2LogicContract = await new AlpsDaoLogicV2Factory(deployer).deploy();
  const proxy = AlpsDaoProxyFactory.connect(proxyAddress, deployer);
  await proxy._setImplementation(v2LogicContract.address);

  const govV2 = AlpsDaoLogicV2Factory.connect(proxyAddress, deployer);
  return govV2;
};

export const deployGovernorV2AndSetQuorumParams = async (
  deployer: SignerWithAddress,
  proxyAddress: string,
): Promise<AlpsDAOLogicV2> => {
  const govV2 = await deployGovernorV2(deployer, proxyAddress);
  await govV2._setDynamicQuorumParams(MIN_QUORUM_VOTES_BPS, MAX_QUORUM_VOTES_BPS, 0);

  return govV2;
};

export const propose = async (
  gov: AlpsDAOLogicV1 | AlpsDAOLogicV2,
  proposer: SignerWithAddress,
  stubPropUserAddress: string = address(0),
) => {
  const targets = [stubPropUserAddress];
  const values = ['0'];
  const signatures = ['getBalanceOf(address)'];
  const callDatas = [encodeParameters(['address'], [stubPropUserAddress])];

  await gov.connect(proposer).propose(targets, values, signatures, callDatas, 'do nothing');
  return await gov.latestProposalIds(proposer.address);
};

function dataToDescriptorInput(data: string[]): {
  encodedCompressed: string;
  originalLength: number;
  itemCount: number;
} {
  const abiEncoded = ethers.utils.defaultAbiCoder.encode(['bytes[]'], [data]);
  const encodedCompressed = `0x${deflateRawSync(
    Buffer.from(abiEncoded.substring(2), 'hex'),
  ).toString('hex')}`;

  const originalLength = abiEncoded.substring(2).length / 2;
  const itemCount = data.length;

  return {
    encodedCompressed,
    originalLength,
    itemCount,
  };
}

export const parseTraitName = (fileName: string): string => {
  const capitalizeFirstLetter = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  fileName = fileName
    .substring(fileName.indexOf('-') + 1)
    .split('-')
    .map(name => capitalizeFirstLetter(name))
    .join(' ');

  return fileName;
};

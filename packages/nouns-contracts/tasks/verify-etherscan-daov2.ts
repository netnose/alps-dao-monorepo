import { task, types } from 'hardhat/config';
import { ContractName, ContractNamesDAOV2, DeployedContract } from './types';

// prettier-ignore
// These contracts require a fully qualified name to be passed because
// they share bytecode with the underlying contract.
const nameToFullyQualifiedName: Record<string, string> = {
  AlpsAuctionHouseProxy: 'contracts/proxies/AlpsAuctionHouseProxy.sol:AlpsAuctionHouseProxy',
  AlpsAuctionHouseProxyAdmin: 'contracts/proxies/AlpsAuctionHouseProxyAdmin.sol:AlpsAuctionHouseProxyAdmin',
  AlpsDAOLogicV2Harness: 'contracts/test/AlpsDAOLogicV2Harness.sol:AlpsDAOLogicV2Harness'
};

task('verify-etherscan-daov2', 'Verify the Solidity contracts on Etherscan')
  .addParam('contracts', 'Contract objects from the deployment', undefined, types.json)
  .setAction(
    async ({ contracts }: { contracts: Record<ContractNamesDAOV2, DeployedContract> }, hre) => {
      for (const [, contract] of Object.entries(contracts)) {
        console.log(`verifying ${contract.name}...`);
        try {
          const code = await contract.instance?.provider.getCode(contract.address);
          if (code === '0x') {
            console.log(
              `${contract.name} contract deployment has not completed. waiting to verify...`,
            );
            await contract.instance?.deployed();
          }
          await hre.run('verify:verify', {
            ...contract,
            contract: nameToFullyQualifiedName[contract.name],
          });
        } catch ({ message }) {
          if ((message as string).includes('Reason: Already Verified')) {
            continue;
          }
          console.error(message);
        }
      }
    },
  );

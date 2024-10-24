import { useContractCall } from '@usedapp/core';
import { BigNumber as EthersBN, utils } from 'ethers';
import { AlpsAuctionHouseABI } from '@nouns/sdk';
import config from '../config';
import BigNumber from 'bignumber.js';
import { isAlperAlp } from '../utils/alperAlp';
import { useAppSelector } from '../hooks';
import { AuctionState } from '../state/slices/auction';

export enum AuctionHouseContractFunction {
  auction = 'auction',
  duration = 'duration',
  minBidIncrementPercentage = 'minBidIncrementPercentage',
  alps = 'alps',
  createBid = 'createBid',
  settleCurrentAndCreateNewAuction = 'settleCurrentAndCreateNewAuction',
}

export interface Auction {
  amount: EthersBN;
  bidder: string;
  endTime: EthersBN;
  startTime: EthersBN;
  alpId: EthersBN;
  settled: boolean;
}

const abi = new utils.Interface(AlpsAuctionHouseABI);

export const useAuction = (auctionHouseProxyAddress: string) => {
  const auction = useContractCall<Auction>({
    abi,
    address: auctionHouseProxyAddress,
    method: 'auction',
    args: [],
  });
  return auction as Auction;
};

export const useAuctionMinBidIncPercentage = () => {
  const minBidIncrement = useContractCall({
    abi,
    address: config.addresses.alpsAuctionHouseProxy,
    method: 'minBidIncrementPercentage',
    args: [],
  });

  if (!minBidIncrement) {
    return;
  }

  return new BigNumber(minBidIncrement[0]);
};

/**
 * Computes timestamp after which a Alp could vote
 * @param alpId TokenId of Alp
 * @returns Unix timestamp after which Alp could vote
 */
export const useAlpCanVoteTimestamp = (alpId: number) => {
  const nextAlpId = alpId + 1;

  const nextAlpIdForQuery = isAlperAlp(EthersBN.from(nextAlpId)) ? nextAlpId + 1 : nextAlpId;

  const pastAuctions = useAppSelector(state => state.pastAuctions.pastAuctions);

  const maybeAlpCanVoteTimestamp = pastAuctions.find((auction: AuctionState, i: number) => {
    const maybeAlpId = auction.activeAuction?.alpId;
    return maybeAlpId ? EthersBN.from(maybeAlpId).eq(EthersBN.from(nextAlpIdForQuery)) : false;
  })?.activeAuction?.startTime;

  if (!maybeAlpCanVoteTimestamp) {
    // This state only occurs during loading flashes
    return EthersBN.from(0);
  }

  return EthersBN.from(maybeAlpCanVoteTimestamp);
};

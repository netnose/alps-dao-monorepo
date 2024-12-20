import { Col, Row } from 'react-bootstrap';
import { BigNumber } from 'ethers';
import AuctionActivityWrapper from '../AuctionActivityWrapper';
import AuctionNavigation from '../AuctionNavigation';
import AuctionActivityAlpTitle from '../AuctionActivityAlpTitle';
import AuctionActivityDateHeadline from '../AuctionActivityDateHeadline';
import AuctionTitleAndNavWrapper from '../AuctionTitleAndNavWrapper';
import alpContentClasses from './AlperAlpContent.module.css';
import auctionBidClasses from '../AuctionActivity/BidHistory.module.css';
import auctionActivityClasses from '../AuctionActivity/AuctionActivity.module.css';
import CurrentBid, { BID_N_A } from '../CurrentBid';
import Winner from '../Winner';

import { useAppSelector } from '../../hooks';
import { useCallback, useEffect } from 'react';

const AlperAlpContent: React.FC<{
  mintTimestamp: BigNumber;
  alpId: BigNumber;
  isFirstAuction: boolean;
  isLastAuction: boolean;
  onPrevAuctionClick: () => void;
  onNextAuctionClick: () => void;
}> = props => {
  const {
    mintTimestamp,
    alpId,
    isFirstAuction,
    isLastAuction,
    onPrevAuctionClick,
    onNextAuctionClick,
  } = props;

  const isCool = useAppSelector(state => state.application.isCoolBackground);

  const alpIdNumber: number = alpId.toNumber();
  let block: any;
  let isAlperAlp = false;
  let isAlpsCouncil = false;

  if (alpIdNumber % 10 === 0) {
    isAlperAlp = true;
    isAlpsCouncil = false;

    block = (
      <ul className={auctionBidClasses.bidCollection}>
        <li
          className={
            (isCool ? `${auctionBidClasses.bidRowCool}` : `${auctionBidClasses.bidRowWarm}`) +
            ` ${alpContentClasses.bidRow}`
          }
        >
          <span
            style={{ color: isCool ? 'var(--brand-black)' : 'var(--brand-white)' }}
            className={alpContentClasses.mobileText}
          >
            {/* <Trans>All Alp auction proceeds are sent to the </Trans>{' '}
            <Link to="/vote" className={alpContentClasses.link}>
              <Trans>Alps DAO</Trans>
            </Link>
            .{' '} */}
            <p>
              Because 100% of Alp auction proceeds are sent to the Alps treasury, the founders have
              chosen to compensate themselves with Alp tokens. Every 10th Alp for the first 5 years of
              the project (Alp IDs #0, #10, #20, #30 and so on) will be automatically sent to a
              multisig to be vested and shared among the founding members of the project.
            </p>
          </span>
        </li>
      </ul>
    );
  } else if (alpIdNumber % 5 === 0) {
    isAlperAlp = false;
    isAlpsCouncil = true;

    block = (
      <ul className={auctionBidClasses.bidCollection}>
        <li
          className={
            (isCool ? `${auctionBidClasses.bidRowCool}` : `${auctionBidClasses.bidRowWarm}`) +
            ` ${alpContentClasses.bidRow}`
          }
        >
          <span
            style={{ color: isCool ? 'var(--brand-black)' : 'var(--brand-white)' }}
            className={alpContentClasses.mobileText}
          >
            <p>
              Every 10th Alp with ID ending in "5" for the first 5 years of the
              project (Alp IDs #5, #15, #25, #35 and so on) will be automatically sent to
              The Alpine Council to be utilized by active Alpine Council members in voting.
            </p>
          </span>
        </li>
      </ul>
    );
  }

  // Page through Alps via keyboard
  // handle what happens on key press
  const handleKeyPress = useCallback(
    event => {
      console.log(event);
      if (event.key === 'ArrowLeft') {
        onPrevAuctionClick();
      }
      if (event.key === 'ArrowRight') {
        onNextAuctionClick();
      }
    },
    [onNextAuctionClick, onPrevAuctionClick],
  );

  useEffect(() => {
    // attach the event listener
    document.addEventListener('keydown', handleKeyPress);

    // remove the event listener
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  return (
    <AuctionActivityWrapper>
      <div className={auctionActivityClasses.informationRow}>
        <Row className={auctionActivityClasses.activityRow}>
          <AuctionTitleAndNavWrapper>
            <AuctionNavigation
              isFirstAuction={isFirstAuction}
              isLastAuction={isLastAuction}
              onNextAuctionClick={onNextAuctionClick}
              onPrevAuctionClick={onPrevAuctionClick}
            />
            <AuctionActivityDateHeadline startTime={mintTimestamp} />
          </AuctionTitleAndNavWrapper>
          <Col lg={12}>
            <AuctionActivityAlpTitle alpId={alpId} />
          </Col>
        </Row>
        <Row className={auctionActivityClasses.activityRow}>
          <Col lg={4} className={auctionActivityClasses.currentBidCol}>
            <CurrentBid currentBid={BID_N_A} auctionEnded={true} />
          </Col>
          <Col
            lg={5}
            className={`${auctionActivityClasses.currentBidCol} ${alpContentClasses.currentBidCol} ${auctionActivityClasses.auctionTimerCol}`}
          >
            <div className={auctionActivityClasses.section}>
              <Winner winner={''} isAlpers={isAlperAlp} isAlpsCouncil={isAlpsCouncil} />
            </div>
          </Col>
        </Row>
      </div>
      <Row className={auctionActivityClasses.activityRow}>
        <Col lg={12}>
          {block}
          {/* <div
            className={
              isCool ? bidBtnClasses.bidHistoryWrapperCool : bidBtnClasses.bidHistoryWrapperWarm
            }
          >
            <Link
              to="/alpers"
              className={isCool ? bidBtnClasses.bidHistoryCool : bidBtnClasses.bidHistoryWarm}
            >
              <Trans>Learn more</Trans> →
            </Link>
          </div> */}
        </Col>
      </Row>
    </AuctionActivityWrapper>
  );
};
export default AlperAlpContent;

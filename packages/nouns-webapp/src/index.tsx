import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import account from './state/slices/account';
import application from './state/slices/application';
import logs from './state/slices/logs';
import auction, {
  reduxSafeAuction,
  reduxSafeNewAuction,
  reduxSafeBid,
  setActiveAuction,
  setAuctionExtended,
  setAuctionSettled,
  setFullAuction,
} from './state/slices/auction';
import onDisplayAuction, {
  setLastAuctionAlpId,
  setOnDisplayAuctionAlpId,
} from './state/slices/onDisplayAuction';
import { ApolloProvider, useQuery } from '@apollo/client';
import { clientFactory, latestAuctionsQuery } from './wrappers/subgraph';
import { useEffect } from 'react';
import pastAuctions, { addPastAuctions } from './state/slices/pastAuctions';
import LogsUpdater from './state/updaters/logs';
import config from './config';
import { WebSocketProvider } from '@ethersproject/providers';
import { BigNumber, BigNumberish } from 'ethers';
import { AlpsAuctionHouseFactory } from '@nouns/sdk';
import dotenv from 'dotenv';
import { useAppDispatch, useAppSelector } from './hooks';
import { appendBid } from './state/slices/auction';
import { ConnectedRouter, connectRouter } from 'connected-react-router';
import { createBrowserHistory, History } from 'history';
import { applyMiddleware, createStore, combineReducers, PreloadedState } from 'redux';
import { routerMiddleware } from 'connected-react-router';
import { Provider } from 'react-redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import { alpPath } from './utils/history';
import { push } from 'connected-react-router';
import { LanguageProvider } from './i18n/LanguageProvider';

dotenv.config();

export const history = createBrowserHistory();

const createRootReducer = (history: History) =>
  combineReducers({
    router: connectRouter(history),
    account,
    application,
    auction,
    logs,
    pastAuctions,
    onDisplayAuction,
  });

export default function configureStore(preloadedState: PreloadedState<any>) {
  const store = createStore(
    createRootReducer(history), // root reducer with router state
    preloadedState,
    composeWithDevTools(
      applyMiddleware(
        routerMiddleware(history), // for dispatching history actions
        // ... other middlewares ...
      ),
    ),
  );

  return store;
}

const store = configureStore({});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

const client = clientFactory(config.app.subgraphApiUri);

const Updaters = () => {
  return (
    <>
      <LogsUpdater />
    </>
  );
};

const BLOCKS_PER_DAY = 6_500;

const ChainSubscriber: React.FC = () => {
  const dispatch = useAppDispatch();

  const loadState = async () => {
    const wsProvider = new WebSocketProvider(config.app.wsRpcUri);
    const alpsAuctionHouseContract = AlpsAuctionHouseFactory.connect(
      config.addresses.alpsAuctionHouseProxy,
      wsProvider,
    );

    const bidFilter = alpsAuctionHouseContract.filters.AuctionBid(null, null, null, null);
    const extendedFilter = alpsAuctionHouseContract.filters.AuctionExtended(null, null);
    const createdFilter = alpsAuctionHouseContract.filters.AuctionCreated(null, null, null);
    const settledFilter = alpsAuctionHouseContract.filters.AuctionSettled(null, null, null);
    const processBidFilter = async (
      alpId: BigNumberish,
      sender: string,
      value: BigNumberish,
      extended: boolean,
      event: any,
    ) => {
      const timestamp = (await event.getBlock()).timestamp;
      const transactionHash = event.transactionHash;
      dispatch(
        appendBid(reduxSafeBid({ alpId, sender, value, extended, transactionHash, timestamp })),
      );
    };
    const processAuctionCreated = (
      alpId: BigNumberish,
      startTime: BigNumberish,
      endTime: BigNumberish,
    ) => {
      dispatch(
        setActiveAuction(reduxSafeNewAuction({ alpId, startTime, endTime, settled: false })),
      );
      const alpIdNumber = BigNumber.from(alpId).toNumber();
      dispatch(push(alpPath(alpIdNumber)));
      dispatch(setOnDisplayAuctionAlpId(alpIdNumber));
      dispatch(setLastAuctionAlpId(alpIdNumber));
    };
    const processAuctionExtended = (alpId: BigNumberish, endTime: BigNumberish) => {
      dispatch(setAuctionExtended({ alpId, endTime }));
    };
    const processAuctionSettled = (alpId: BigNumberish, winner: string, amount: BigNumberish) => {
      dispatch(setAuctionSettled({ alpId, amount, winner }));
    };

    // Fetch the current auction
    const currentAuction = await alpsAuctionHouseContract.auction();
    dispatch(setFullAuction(reduxSafeAuction(currentAuction)));
    dispatch(setLastAuctionAlpId(currentAuction.alpId.toNumber()));

    // Fetch the previous 24hours of  bids
    const previousBids = await alpsAuctionHouseContract.queryFilter(bidFilter, 0 - BLOCKS_PER_DAY);
    for (let event of previousBids) {
      if (event.args === undefined) return;
      processBidFilter(...(event.args as [BigNumber, string, BigNumber, boolean]), event);
    }

    alpsAuctionHouseContract.on(bidFilter, (alpId, sender, value, extended, event) =>
      processBidFilter(alpId, sender, value, extended, event),
    );
    alpsAuctionHouseContract.on(createdFilter, (alpId, startTime, endTime) =>
      processAuctionCreated(alpId, startTime, endTime),
    );
    alpsAuctionHouseContract.on(extendedFilter, (alpId, endTime) =>
      processAuctionExtended(alpId, endTime),
    );
    alpsAuctionHouseContract.on(settledFilter, (alpId, winner, amount) =>
      processAuctionSettled(alpId, winner, amount),
    );
  };
  loadState();

  return <></>;
};

const PastAuctions: React.FC = () => {
  const latestAuctionId = useAppSelector(state => state.onDisplayAuction.lastAuctionAlpId);
  const { data } = useQuery(latestAuctionsQuery());
  const dispatch = useAppDispatch();

  useEffect(() => {
    data && dispatch(addPastAuctions({ data }));
  }, [data, latestAuctionId, dispatch]);

  return <></>;
};

ReactDOM.render(
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <ChainSubscriber />
      <React.StrictMode>
        <Web3ReactProvider
          getLibrary={
            provider => new Web3Provider(provider) // this will vary according to whether you use e.g. ethers or web3.js
          }
        >
          <ApolloProvider client={client}>
            <PastAuctions />
            <LanguageProvider>
              <App />
            </LanguageProvider>
            <Updaters />
          </ApolloProvider>
        </Web3ReactProvider>
      </React.StrictMode>
    </ConnectedRouter>
  </Provider>,
  document.getElementById('root'),
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

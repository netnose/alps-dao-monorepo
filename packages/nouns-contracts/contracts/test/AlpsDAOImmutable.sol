// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import '../governance/AlpsDAOLogicV1.sol';

contract AlpsDAOImmutable is AlpsDAOLogicV1 {
    constructor(
        address timelock_,
        address alps_,
        address admin_,
        address vetoer_,
        uint256 votingPeriod_,
        uint256 votingDelay_,
        uint256 proposalThresholdBPS_,
        uint256 quorumVotesBPS_
    ) {
        admin = msg.sender;
        initialize(timelock_, alps_, vetoer_, votingPeriod_, votingDelay_, proposalThresholdBPS_, quorumVotesBPS_);

        admin = admin_;
    }

    function initialize(
        address timelock_,
        address alps_,
        address vetoer_,
        uint256 votingPeriod_,
        uint256 votingDelay_,
        uint256 proposalThresholdBPS_,
        uint256 quorumVotesBPS_
    ) public override {
        require(msg.sender == admin, 'AlpsDAO::initialize: admin only');
        require(address(timelock) == address(0), 'AlpsDAO::initialize: can only initialize once');

        timelock = IAlpsDAOExecutor(timelock_);
        alps = AlpsTokenLike(alps_);
        vetoer = vetoer_;
        votingPeriod = votingPeriod_;
        votingDelay = votingDelay_;
        proposalThresholdBPS = proposalThresholdBPS_;
        quorumVotesBPS = quorumVotesBPS_;
    }
}

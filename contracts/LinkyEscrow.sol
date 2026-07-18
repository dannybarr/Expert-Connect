// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title LinkyEscrow
/// @notice Pay-to-Speak escrow: buyer locks USDC for an expert; expert releases
///         after delivering; buyer can refund if expert is unresponsive past the
///         refundDelay. Splits release into expertAmount + treasury fee.
contract LinkyEscrow {
    enum Status { NONE, ACTIVE, RELEASED, REFUNDED }

    struct Booking {
        address buyer;
        address expert;
        uint256 amount;
        uint64 createdAt;
        Status status;
    }

    IERC20 public immutable usdc;
    address public immutable treasury;
    uint256 public immutable feeBps;
    uint256 public immutable refundDelay;

    mapping(bytes32 => Booking) public bookings;

    event Booked(bytes32 indexed id, address indexed buyer, address indexed expert, uint256 amount);
    event Released(bytes32 indexed id, address indexed expert, uint256 expertAmount, uint256 feeAmount);
    event Refunded(bytes32 indexed id, address indexed buyer, uint256 amount);

    error AlreadyExists();
    error NotActive();
    error NotExpert();
    error NotBuyer();
    error TooEarly();
    error TransferFailed();

    /// @param _usdc        USDC token contract on the target chain
    /// @param _treasury    Platform treasury address
    /// @param _feeBps      Platform fee in basis points (e.g. 500 = 5%)
    /// @param _refundDelay Seconds buyer must wait before they can refund (e.g. 7 days)
    constructor(address _usdc, address _treasury, uint256 _feeBps, uint256 _refundDelay) {
        require(_usdc != address(0) && _treasury != address(0), "zero addr");
        require(_feeBps <= 10_000, "fee too high");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        feeBps = _feeBps;
        refundDelay = _refundDelay;
    }

    /// @notice Lock `amount` USDC for `expert`. Caller must have approved this
    ///         contract for `amount` USDC. `id` is an off-chain UUID encoded
    ///         as bytes32; reused IDs revert.
    function book(bytes32 id, address expert, uint256 amount) external {
        if (bookings[id].status != Status.NONE) revert AlreadyExists();
        require(expert != address(0) && amount > 0, "bad input");
        bookings[id] = Booking({
            buyer: msg.sender,
            expert: expert,
            amount: amount,
            createdAt: uint64(block.timestamp),
            status: Status.ACTIVE
        });
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Booked(id, msg.sender, expert, amount);
    }

    /// @notice Expert releases escrow to themselves (95%) and treasury (5%).
    function release(bytes32 id) external {
        Booking storage b = bookings[id];
        if (b.status != Status.ACTIVE) revert NotActive();
        if (msg.sender != b.expert) revert NotExpert();
        b.status = Status.RELEASED;
        uint256 fee = (b.amount * feeBps) / 10_000;
        uint256 expertAmount = b.amount - fee;
        if (fee > 0 && !usdc.transfer(treasury, fee)) revert TransferFailed();
        if (!usdc.transfer(b.expert, expertAmount)) revert TransferFailed();
        emit Released(id, b.expert, expertAmount, fee);
    }

    /// @notice Buyer reclaims escrow after `refundDelay` has elapsed and the
    ///         expert has not released the funds.
    function refund(bytes32 id) external {
        Booking storage b = bookings[id];
        if (b.status != Status.ACTIVE) revert NotActive();
        if (msg.sender != b.buyer) revert NotBuyer();
        if (block.timestamp < uint256(b.createdAt) + refundDelay) revert TooEarly();
        b.status = Status.REFUNDED;
        if (!usdc.transfer(b.buyer, b.amount)) revert TransferFailed();
        emit Refunded(id, b.buyer, b.amount);
    }
}

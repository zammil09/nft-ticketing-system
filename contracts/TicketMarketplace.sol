// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EventRegistry.sol";
import "./TicketNFT.sol";

/// @title TicketMarketplace
/// @notice يربط الدفع بالعملة المستقرة مع سك التذكرة (الشراء الأساسي) وإعادة البيع بحد أقصى مفروض بالعقد الذكي.
contract TicketMarketplace is ReentrancyGuard {
    IERC20 public immutable stablecoin;
    EventRegistry public immutable registry;
    TicketNFT public immutable ticketNFT;

    event TicketPurchased(
        uint256 indexed eventId,
        uint256 indexed tokenId,
        address indexed buyer,
        address organizer,
        uint256 pricePaid
    );

    event TicketResalePurchased(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 pricePaid
    );

    constructor(address _stablecoin, address _registry, address _ticketNFT) {
        stablecoin = IERC20(_stablecoin);
        registry = EventRegistry(_registry);
        ticketNFT = TicketNFT(_ticketNFT);
    }

    /// @notice الشراء الأساسي: approve مسبق مطلوب من المشتري. دفع + سك بمعاملة واحدة ذرية.
    function buyTicket(uint256 eventId) external nonReentrant returns (uint256 tokenId) {
        EventRegistry.EventData memory ev = registry.getEvent(eventId);

        require(ev.active, "Event is not active");
        require(ev.ticketsSold < ev.maxTickets, "Event sold out");
        require(ev.organizer != address(0), "Event does not exist");

        bool sent = stablecoin.transferFrom(msg.sender, ev.organizer, ev.price);
        require(sent, "Stablecoin transfer failed");

        registry.incrementSold(eventId);
        tokenId = ticketNFT.mintTicket(msg.sender, eventId);

        emit TicketPurchased(eventId, tokenId, msg.sender, ev.organizer, ev.price);
    }

    /// @notice شراء تذكرة معروضة لإعادة البيع — العقد يتحقق من الحد الأقصى المسموح به قبل تنفيذ أي تحويل
    function buyResaleTicket(uint256 tokenId) external nonReentrant {
        uint256 listedPrice = ticketNFT.resaleListingPrice(tokenId);
        require(listedPrice > 0, "Ticket is not listed for resale");

        (uint256 eventId, ) = ticketNFT.ticketInfo(tokenId);
        uint256 maxAllowed = registry.getMaxResalePrice(eventId);
        require(maxAllowed > 0, "Resale is disabled for this event");
        require(listedPrice <= maxAllowed, "Listed price exceeds organizer resale cap");

        address seller = ticketNFT.ownerOf(tokenId);
        require(seller != msg.sender, "Cannot buy your own ticket");

        // ===== دفع + نقل ملكية بمعاملة واحدة ذرية =====
        bool sent = stablecoin.transferFrom(msg.sender, seller, listedPrice);
        require(sent, "Stablecoin transfer failed");

        ticketNFT.completeResale(tokenId, seller, msg.sender, listedPrice);

        emit TicketResalePurchased(tokenId, seller, msg.sender, listedPrice);
    }
}

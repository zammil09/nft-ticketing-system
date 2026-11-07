// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./EventRegistry.sol";

/// @title TicketNFT
/// @notice كل تذكرة = NFT فريد (ERC-721) مع Metadata حقيقية مُولَّدة بالكامل على السلسلة (on-chain، بدون IPFS أو رابط خارجي).
/// فقط عقد الـ Marketplace يقدر يسك تذاكر أو ينفّذ إعادة بيع.
contract TicketNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;

    address public marketplace;
    EventRegistry public immutable eventRegistry;

    struct TicketData {
        uint256 eventId;
        bool checkedIn;
    }

    mapping(uint256 => TicketData) public ticketInfo;
    mapping(uint256 => uint256) public resaleListingPrice;

    event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed buyer);
    event TicketCheckedIn(uint256 indexed tokenId);
    event TicketListedForResale(uint256 indexed tokenId, uint256 price);
    event TicketResaleCancelled(uint256 indexed tokenId);
    event TicketResold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Caller is not the marketplace contract");
        _;
    }

    constructor(address _eventRegistry) ERC721("EventTicket", "TKT") Ownable(msg.sender) {
        require(_eventRegistry != address(0), "Invalid registry address");
        eventRegistry = EventRegistry(_eventRegistry);
    }

    function setMarketplace(address _marketplace) external onlyOwner {
        require(_marketplace != address(0), "Invalid address");
        marketplace = _marketplace;
    }

    function mintTicket(address to, uint256 eventId) external onlyMarketplace returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        ticketInfo[tokenId] = TicketData({eventId: eventId, checkedIn: false});
        emit TicketMinted(tokenId, eventId, to);
        return tokenId;
    }

    function listForResale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the ticket owner");
        require(!ticketInfo[tokenId].checkedIn, "Ticket already used");
        resaleListingPrice[tokenId] = price;
        emit TicketListedForResale(tokenId, price);
    }

    function cancelResaleListing(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not the ticket owner");
        resaleListingPrice[tokenId] = 0;
        emit TicketResaleCancelled(tokenId);
    }

    function completeResale(uint256 tokenId, address from, address to, uint256 price) external onlyMarketplace {
        require(ownerOf(tokenId) == from, "Seller no longer owns this ticket");
        _transfer(from, to, tokenId);
        resaleListingPrice[tokenId] = 0;
        emit TicketResold(tokenId, from, to, price);
    }

    function checkIn(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        require(!ticketInfo[tokenId].checkedIn, "Ticket already used");
        ticketInfo[tokenId].checkedIn = true;
        emit TicketCheckedIn(tokenId);
    }

    function isCheckedIn(uint256 tokenId) external view returns (bool) {
        return ticketInfo[tokenId].checkedIn;
    }

    /// @notice يبني Metadata حقيقية بصيغة JSON مُرمّزة Base64 مباشرة داخل العقد — بدون IPFS أو أي سيرفر خارجي.
    /// يتوافق مع معيار ERC-721 Metadata القياسي (name, description, attributes) اللي تقرأه المحافظ ومنصات العرض تلقائياً.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");

        TicketData memory info = ticketInfo[tokenId];
        EventRegistry.EventData memory ev = eventRegistry.getEvent(info.eventId);

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "', ev.name, ' - Ticket #', tokenId.toString(), '",',
                        '"description": "Blockchain event ticket. Verified on-chain, non-duplicable NFT issued via TicketNFT smart contract.",',
                        '"attributes": [',
                            '{"trait_type": "Event ID", "value": ', info.eventId.toString(), '},',
                            '{"trait_type": "Ticket ID", "value": ', tokenId.toString(), '},',
                            '{"trait_type": "Checked In", "value": "', (info.checkedIn ? "true" : "false"), '"}',
                        ']}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}

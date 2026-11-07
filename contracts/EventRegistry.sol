// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EventRegistry
/// @notice يخزن بيانات الفعاليات: السعر، عدد التذاكر، محفظة المنظّم، وحد إعادة البيع (Resale Cap).
contract EventRegistry {
    struct EventData {
        address organizer;
        string name;
        uint256 price;             // سعر البيع الأساسي بوحدات mUSDC (6 decimals)
        uint256 maxTickets;
        uint256 ticketsSold;
        bool active;
        uint256 resaleCapPercent;  // الحد الأقصى لسعر إعادة البيع كنسبة من السعر الأساسي (مثال: 110 = يسمح ببيع حتى 110% من السعر الأصلي)
    }

    uint256 private _nextEventId;
    mapping(uint256 => EventData) public events;

    address public owner;
    address public marketplace;

    event EventCreated(uint256 indexed eventId, address indexed organizer, string name, uint256 price, uint256 maxTickets, uint256 resaleCapPercent);
    event EventStatusChanged(uint256 indexed eventId, bool active);

    modifier onlyOrganizer(uint256 eventId) {
        require(events[eventId].organizer == msg.sender, "Not the event organizer");
        _;
    }

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Caller is not the marketplace contract");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setMarketplace(address _marketplace) external {
        require(msg.sender == owner, "Only owner");
        require(_marketplace != address(0), "Invalid address");
        marketplace = _marketplace;
    }

    /// @notice إنشاء فعالية جديدة. resaleCapPercent: 100 = يمنع أي ربح بإعادة البيع، 0 = يمنع إعادة البيع كلياً (لو ما حبيت تسمح فيها حط 0)
    function createEvent(
        string calldata name,
        uint256 price,
        uint256 maxTickets,
        uint256 resaleCapPercent
    ) external returns (uint256) {
        require(maxTickets > 0, "maxTickets must be > 0");
        require(bytes(name).length > 0, "Name required");
        require(resaleCapPercent == 0 || resaleCapPercent >= 100, "Cap must be 0 (no resale) or >= 100");

        uint256 eventId = _nextEventId++;
        events[eventId] = EventData({
            organizer: msg.sender,
            name: name,
            price: price,
            maxTickets: maxTickets,
            ticketsSold: 0,
            active: true,
            resaleCapPercent: resaleCapPercent
        });

        emit EventCreated(eventId, msg.sender, name, price, maxTickets, resaleCapPercent);
        return eventId;
    }

    function setActive(uint256 eventId, bool active) external onlyOrganizer(eventId) {
        events[eventId].active = active;
        emit EventStatusChanged(eventId, active);
    }

    function incrementSold(uint256 eventId) external onlyMarketplace {
        EventData storage e = events[eventId];
        require(e.active, "Event is not active");
        require(e.ticketsSold < e.maxTickets, "Sold out");
        e.ticketsSold++;
    }

    function getEvent(uint256 eventId) external view returns (EventData memory) {
        return events[eventId];
    }

    /// @notice يحسب أقصى سعر إعادة بيع مسموح لتذكرة فعالية معيّنة
    function getMaxResalePrice(uint256 eventId) external view returns (uint256) {
        EventData memory e = events[eventId];
        if (e.resaleCapPercent == 0) return 0; // إعادة البيع ممنوعة
        return (e.price * e.resaleCapPercent) / 100;
    }

    function isAvailable(uint256 eventId) external view returns (bool) {
        EventData memory e = events[eventId];
        return e.active && e.ticketsSold < e.maxTickets;
    }
}

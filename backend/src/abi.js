const REGISTRY_ABI = [
  {
    "anonymous": false, "name": "EventCreated", "type": "event",
    "inputs": [
      { "indexed": true, "name": "eventId", "type": "uint256" }, { "indexed": true, "name": "organizer", "type": "address" },
      { "indexed": false, "name": "name", "type": "string" }, { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "maxTickets", "type": "uint256" }, { "indexed": false, "name": "resaleCapPercent", "type": "uint256" }
    ]
  },
  { "anonymous": false, "name": "EventStatusChanged", "type": "event", "inputs": [{ "indexed": true, "name": "eventId", "type": "uint256" }, { "indexed": false, "name": "active", "type": "bool" }] }
];

const MARKETPLACE_ABI = [
  {
    "anonymous": false, "name": "TicketPurchased", "type": "event",
    "inputs": [
      { "indexed": true, "name": "eventId", "type": "uint256" }, { "indexed": true, "name": "tokenId", "type": "uint256" },
      { "indexed": true, "name": "buyer", "type": "address" }, { "indexed": false, "name": "organizer", "type": "address" },
      { "indexed": false, "name": "pricePaid", "type": "uint256" }
    ]
  },
  {
    "anonymous": false, "name": "TicketResalePurchased", "type": "event",
    "inputs": [
      { "indexed": true, "name": "tokenId", "type": "uint256" }, { "indexed": true, "name": "seller", "type": "address" },
      { "indexed": true, "name": "buyer", "type": "address" }, { "indexed": false, "name": "pricePaid", "type": "uint256" }
    ]
  }
];

const TICKET_NFT_ABI = [
  { "anonymous": false, "name": "Transfer", "type": "event", "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": true, "name": "tokenId", "type": "uint256" }] },
  { "anonymous": false, "name": "TicketCheckedIn", "type": "event", "inputs": [{ "indexed": true, "name": "tokenId", "type": "uint256" }] },
  { "anonymous": false, "name": "TicketListedForResale", "type": "event", "inputs": [{ "indexed": true, "name": "tokenId", "type": "uint256" }, { "indexed": false, "name": "price", "type": "uint256" }] },
  { "anonymous": false, "name": "TicketResaleCancelled", "type": "event", "inputs": [{ "indexed": true, "name": "tokenId", "type": "uint256" }] }
];

module.exports = { REGISTRY_ABI, MARKETPLACE_ABI, TICKET_NFT_ABI };

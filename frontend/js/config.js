// ⚠️ عبّي هذي العناوين بعد تنفيذ: npm run deploy:sepolia
const CONTRACT_ADDRESSES = {
  USDC: "0x08362afC1ee6859E847a33f44e89fDa6b3eD82b8",
  REGISTRY: "0x36c1f7b067a5500159aF023215BcaBD3e48b5118",
  TICKET_NFT: "0x1b4c5f54006Ecf21CB1825a89E77D76920a1B2b3",
  MARKETPLACE: "0x7b6153228F6fb1e5134560A778946ec50f7256A0",
};

const SEPOLIA_CHAIN_ID = "0xaa36a7";
const BACKEND_URL = "http://localhost:4000/api"; // اختياري — شغّل الباك إند لو تبي سرعة أعلى

const USDC_ABI = [
  { "inputs": [], "name": "decimals", "outputs": [{ "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "amount", "type": "uint256" }], "name": "faucet", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const REGISTRY_ABI = [
  { "inputs": [{ "name": "name", "type": "string" }, { "name": "price", "type": "uint256" }, { "name": "maxTickets", "type": "uint256" }, { "name": "resaleCapPercent", "type": "uint256" }], "name": "createEvent", "outputs": [{ "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  {
    "inputs": [{ "name": "eventId", "type": "uint256" }], "name": "getEvent",
    "outputs": [{ "components": [
      { "name": "organizer", "type": "address" }, { "name": "name", "type": "string" },
      { "name": "price", "type": "uint256" }, { "name": "maxTickets", "type": "uint256" },
      { "name": "ticketsSold", "type": "uint256" }, { "name": "active", "type": "bool" },
      { "name": "resaleCapPercent", "type": "uint256" }
    ], "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function"
  },
  { "inputs": [{ "name": "eventId", "type": "uint256" }], "name": "getMaxResalePrice", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "anonymous": false, "name": "EventCreated", "type": "event",
    "inputs": [
      { "indexed": true, "name": "eventId", "type": "uint256" }, { "indexed": true, "name": "organizer", "type": "address" },
      { "indexed": false, "name": "name", "type": "string" }, { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "maxTickets", "type": "uint256" }, { "indexed": false, "name": "resaleCapPercent", "type": "uint256" }
    ]
  }
];

const TICKET_NFT_ABI = [
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "ticketInfo", "outputs": [{ "name": "eventId", "type": "uint256" }, { "name": "checkedIn", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "checkIn", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }, { "name": "price", "type": "uint256" }], "name": "listForResale", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "cancelResaleListing", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "resaleListingPrice", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "anonymous": false, "name": "Transfer", "type": "event",
    "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": true, "name": "tokenId", "type": "uint256" }]
  },
  {
    "anonymous": false, "name": "TicketListedForResale", "type": "event",
    "inputs": [{ "indexed": true, "name": "tokenId", "type": "uint256" }, { "indexed": false, "name": "price", "type": "uint256" }]
  }
];

const MARKETPLACE_ABI = [
  { "inputs": [{ "name": "eventId", "type": "uint256" }], "name": "buyTicket", "outputs": [{ "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "tokenId", "type": "uint256" }], "name": "buyResaleTicket", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  {
    "anonymous": false, "name": "TicketPurchased", "type": "event",
    "inputs": [
      { "indexed": true, "name": "eventId", "type": "uint256" }, { "indexed": true, "name": "tokenId", "type": "uint256" },
      { "indexed": true, "name": "buyer", "type": "address" }, { "indexed": false, "name": "organizer", "type": "address" },
      { "indexed": false, "name": "pricePaid", "type": "uint256" }
    ]
  }
];
